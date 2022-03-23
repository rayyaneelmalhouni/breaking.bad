<script>
	import { onMount } from 'svelte';
	import Character from "./components/Character.svelte";
	import Search from "./components/Search.svelte";
	let data  = [];
	let names = []
	onMount(async () => {
		const response = await fetch("https://breakingbadapi.com/api/characters")
		data = await response.json();
		getNames();
	})
	function getNames() {
		for (let i = 0; i< data.length; i++) {
			names  = [...names, data[i].name]
		}
	}
    function showCharacter(e) {
		console.log(e.detail.name)
	}
</script>
<style>
	h1, h2 {
		text-align: center;
	}
	.title {
		color: #A9A9A9;
		font-size: 2em;
		margin-top: 20px;
	}
	.sub-title {
		color: 	#0000CD;
		letter-spacing: .4em;
		font-size: .9em;
	}
</style>
<h1 class="title">Breaking Bad</h1>
<h2 class="sub-title">Characters</h2>
<Search {names} on:character={showCharacter}/>
<Character />