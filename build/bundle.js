var app = (function () {
    'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function select_option(select, value) {
        for (let i = 0; i < select.options.length; i += 1) {
            const option = select.options[i];
            if (option.__value === value) {
                option.selected = true;
                return;
            }
        }
        select.selectedIndex = -1; // no option should be selected
    }
    function select_value(select) {
        const selected_option = select.querySelector(':checked') || select.options[0];
        return selected_option && selected_option.__value;
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    /* src\components\Character.svelte generated by Svelte v3.46.4 */

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[7] = list[i];
    	return child_ctx;
    }

    // (76:0) {:else}
    function create_else_block$1(ctx) {
    	let h1;

    	return {
    		c() {
    			h1 = element("h1");
    			h1.textContent = "No person showed";
    			attr(h1, "class", "svelte-2d7830");
    		},
    		m(target, anchor) {
    			insert(target, h1, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(h1);
    		}
    	};
    }

    // (61:4) {#if person}
    function create_if_block$2(ctx) {
    	let div;
    	let h10;
    	let t0;
    	let t1;
    	let h20;
    	let t2;
    	let t3;
    	let img_1;
    	let img_1_src_value;
    	let t4;
    	let h11;
    	let t6;
    	let h21;
    	let t8;
    	let p0;
    	let t9;
    	let t10;
    	let h22;
    	let t12;
    	let t13;
    	let h23;
    	let t15;
    	let p1;
    	let t16;
    	let each_value = /*occupations*/ ctx[4];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	return {
    		c() {
    			div = element("div");
    			h10 = element("h1");
    			t0 = text(/*name*/ ctx[6]);
    			t1 = space();
    			h20 = element("h2");
    			t2 = text(/*birthday*/ ctx[5]);
    			t3 = space();
    			img_1 = element("img");
    			t4 = space();
    			h11 = element("h1");
    			h11.textContent = "More:";
    			t6 = space();
    			h21 = element("h2");
    			h21.textContent = "Nickname:";
    			t8 = space();
    			p0 = element("p");
    			t9 = text(/*nickname*/ ctx[2]);
    			t10 = space();
    			h22 = element("h2");
    			h22.textContent = "Ocuupations:";
    			t12 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t13 = space();
    			h23 = element("h2");
    			h23.textContent = "Status:";
    			t15 = space();
    			p1 = element("p");
    			t16 = text(/*status*/ ctx[1]);
    			attr(h10, "class", "name svelte-2d7830");
    			attr(h20, "class", "birthday svelte-2d7830");
    			if (!src_url_equal(img_1.src, img_1_src_value = /*img*/ ctx[3])) attr(img_1, "src", img_1_src_value);
    			attr(img_1, "alt", /*name*/ ctx[6]);
    			attr(img_1, "class", "svelte-2d7830");
    			attr(h11, "class", "title svelte-2d7830");
    			attr(h21, "class", "nickname svelte-2d7830");
    			attr(p0, "class", "svelte-2d7830");
    			attr(h22, "class", "sub-title svelte-2d7830");
    			attr(h23, "class", "status svelte-2d7830");
    			attr(p1, "class", "svelte-2d7830");
    			attr(div, "class", "profolio svelte-2d7830");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, h10);
    			append(h10, t0);
    			append(div, t1);
    			append(div, h20);
    			append(h20, t2);
    			append(div, t3);
    			append(div, img_1);
    			append(div, t4);
    			append(div, h11);
    			append(div, t6);
    			append(div, h21);
    			append(div, t8);
    			append(div, p0);
    			append(p0, t9);
    			append(div, t10);
    			append(div, h22);
    			append(div, t12);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			append(div, t13);
    			append(div, h23);
    			append(div, t15);
    			append(div, p1);
    			append(p1, t16);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*name*/ 64) set_data(t0, /*name*/ ctx[6]);
    			if (dirty & /*birthday*/ 32) set_data(t2, /*birthday*/ ctx[5]);

    			if (dirty & /*img*/ 8 && !src_url_equal(img_1.src, img_1_src_value = /*img*/ ctx[3])) {
    				attr(img_1, "src", img_1_src_value);
    			}

    			if (dirty & /*name*/ 64) {
    				attr(img_1, "alt", /*name*/ ctx[6]);
    			}

    			if (dirty & /*nickname*/ 4) set_data(t9, /*nickname*/ ctx[2]);

    			if (dirty & /*occupations*/ 16) {
    				each_value = /*occupations*/ ctx[4];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, t13);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*status*/ 2) set_data(t16, /*status*/ ctx[1]);
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};
    }

    // (70:4) {#each occupations as occupation}
    function create_each_block$1(ctx) {
    	let p;
    	let t_value = /*occupation*/ ctx[7] + "";
    	let t;

    	return {
    		c() {
    			p = element("p");
    			t = text(t_value);
    			attr(p, "class", "occupation svelte-2d7830");
    		},
    		m(target, anchor) {
    			insert(target, p, anchor);
    			append(p, t);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*occupations*/ 16 && t_value !== (t_value = /*occupation*/ ctx[7] + "")) set_data(t, t_value);
    		},
    		d(detaching) {
    			if (detaching) detach(p);
    		}
    	};
    }

    function create_fragment$2(ctx) {
    	let div;

    	function select_block_type(ctx, dirty) {
    		if (/*person*/ ctx[0]) return create_if_block$2;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	return {
    		c() {
    			div = element("div");
    			if_block.c();
    			attr(div, "class", "container svelte-2d7830");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			if_block.m(div, null);
    		},
    		p(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			if_block.d();
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let name;
    	let birthday;
    	let occupations;
    	let img;
    	let nickname;
    	let status;
    	let { person = {} } = $$props;

    	$$self.$$set = $$props => {
    		if ('person' in $$props) $$invalidate(0, person = $$props.person);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*person*/ 1) {
    			$$invalidate(6, name = person.name);
    		}

    		if ($$self.$$.dirty & /*person*/ 1) {
    			$$invalidate(5, birthday = person.birthday);
    		}

    		if ($$self.$$.dirty & /*person*/ 1) {
    			$$invalidate(4, occupations = person.occupation);
    		}

    		if ($$self.$$.dirty & /*person*/ 1) {
    			$$invalidate(3, img = person.img);
    		}

    		if ($$self.$$.dirty & /*person*/ 1) {
    			$$invalidate(2, nickname = person.nickname);
    		}

    		if ($$self.$$.dirty & /*person*/ 1) {
    			$$invalidate(1, status = person.status);
    		}
    	};

    	return [person, status, nickname, img, occupations, birthday, name];
    }

    class Character extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { person: 0 });
    	}
    }

    /* src\components\Search.svelte generated by Svelte v3.46.4 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i];
    	return child_ctx;
    }

    // (70:4) {:else}
    function create_else_block(ctx) {
    	let option;

    	return {
    		c() {
    			option = element("option");
    			option.textContent = "Awaiting...";
    			option.__value = "Nothing";
    			option.value = option.__value;
    		},
    		m(target, anchor) {
    			insert(target, option, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(option);
    		}
    	};
    }

    // (66:4) {#if names}
    function create_if_block$1(ctx) {
    	let each_1_anchor;
    	let each_value = /*names*/ ctx[0];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	return {
    		c() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, each_1_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*names*/ 1) {
    				each_value = /*names*/ ctx[0];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(each_1_anchor);
    		}
    	};
    }

    // (67:4) {#each names as name}
    function create_each_block(ctx) {
    	let option;
    	let t_value = /*name*/ ctx[5] + "";
    	let t;
    	let option_value_value;

    	return {
    		c() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*name*/ ctx[5];
    			option.value = option.__value;
    		},
    		m(target, anchor) {
    			insert(target, option, anchor);
    			append(option, t);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*names*/ 1 && t_value !== (t_value = /*name*/ ctx[5] + "")) set_data(t, t_value);

    			if (dirty & /*names*/ 1 && option_value_value !== (option_value_value = /*name*/ ctx[5])) {
    				option.__value = option_value_value;
    				option.value = option.__value;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(option);
    		}
    	};
    }

    function create_fragment$1(ctx) {
    	let div;
    	let select;
    	let t0;
    	let button;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*names*/ ctx[0]) return create_if_block$1;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	return {
    		c() {
    			div = element("div");
    			select = element("select");
    			if_block.c();
    			t0 = space();
    			button = element("button");
    			button.textContent = "Search";
    			attr(select, "name", "cars");
    			attr(select, "id", "cars");
    			attr(select, "class", "selector svelte-ml7hox");
    			if (/*character*/ ctx[1] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[3].call(select));
    			attr(button, "class", "submit_btn svelte-ml7hox");
    			attr(div, "class", "search-container svelte-ml7hox");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, select);
    			if_block.m(select, null);
    			select_option(select, /*character*/ ctx[1]);
    			append(div, t0);
    			append(div, button);

    			if (!mounted) {
    				dispose = [
    					listen(select, "change", /*select_change_handler*/ ctx[3]),
    					listen(button, "click", /*search*/ ctx[2])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(select, null);
    				}
    			}

    			if (dirty & /*character, names*/ 3) {
    				select_option(select, /*character*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	const dispatch = createEventDispatcher();
    	let { names = [] } = $$props;
    	let character = "Walter White";

    	function search() {
    		dispatch("character", { name: character });
    	}

    	function select_change_handler() {
    		character = select_value(this);
    		$$invalidate(1, character);
    		$$invalidate(0, names);
    	}

    	$$self.$$set = $$props => {
    		if ('names' in $$props) $$invalidate(0, names = $$props.names);
    	};

    	return [names, character, search, select_change_handler];
    }

    class Search extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { names: 0 });
    	}
    }

    /* src\App.svelte generated by Svelte v3.46.4 */

    function create_if_block(ctx) {
    	let character;
    	let current;
    	character = new Character({ props: { person: /*person*/ ctx[1] } });

    	return {
    		c() {
    			create_component(character.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(character, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const character_changes = {};
    			if (dirty & /*person*/ 2) character_changes.person = /*person*/ ctx[1];
    			character.$set(character_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(character.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(character.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(character, detaching);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let h1;
    	let t1;
    	let h2;
    	let t3;
    	let search;
    	let t4;
    	let if_block_anchor;
    	let current;
    	search = new Search({ props: { names: /*names*/ ctx[0] } });
    	search.$on("character", /*showCharacter*/ ctx[2]);
    	let if_block = /*person*/ ctx[1] && create_if_block(ctx);

    	return {
    		c() {
    			h1 = element("h1");
    			h1.textContent = "Breaking Bad";
    			t1 = space();
    			h2 = element("h2");
    			h2.textContent = "Characters";
    			t3 = space();
    			create_component(search.$$.fragment);
    			t4 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			attr(h1, "class", "title svelte-56glnm");
    			attr(h2, "class", "sub-title svelte-56glnm");
    		},
    		m(target, anchor) {
    			insert(target, h1, anchor);
    			insert(target, t1, anchor);
    			insert(target, h2, anchor);
    			insert(target, t3, anchor);
    			mount_component(search, target, anchor);
    			insert(target, t4, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const search_changes = {};
    			if (dirty & /*names*/ 1) search_changes.names = /*names*/ ctx[0];
    			search.$set(search_changes);

    			if (/*person*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*person*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(search.$$.fragment, local);
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(search.$$.fragment, local);
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(h1);
    			if (detaching) detach(t1);
    			if (detaching) detach(h2);
    			if (detaching) detach(t3);
    			destroy_component(search, detaching);
    			if (detaching) detach(t4);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let data = [];
    	let names = [];
    	let person;

    	onMount(async () => {
    		const response = await fetch("https://breakingbadapi.com/api/characters");
    		data = await response.json();
    		getNames();
    	});

    	function getNames() {
    		for (let i = 0; i < data.length; i++) {
    			$$invalidate(0, names = [...names, data[i].name]);
    		}
    	}

    	function showCharacter(e) {
    		$$invalidate(1, person = data[names.indexOf(e.detail.name)]);
    	}

    	return [names, person, showCharacter];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, {});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
