<script>
	import { onMount } from 'svelte';
	import Character from "./components/Character.svelte";
	import Search from "./components/Search.svelte";
	let data  = [];
	let names = [];
	let person = {};
	onMount(async () => {
		const response = await fetch("https://breakingbadapi.com/api/characters")
		data = await response.json();
		console.log(data)
		getNames();
	})
	function getNames() {
		for (let i = 0; i< data.length; i++) {
			names  = [...names, data[i].name]
		}
	}
    function showCharacter(e) {
		person = data[names.indexOf(e.detail.name)]
		console.log(person)
	}
</script>
<style>
	h1, h2 {
		text-align: center;
	}
	.title {
		color: #A9A9A9;
		
		margin-top: 20px;
	}
	.sub-title {
		color: 	#0000CD;
		letter-spacing: .4em;
		font-size: .9em;
	}
	@media only screen and (max-width: 600px) {
		.title {
			font-size: 1.3em;
		}
		.sub-title {
			font-size: .7;
			letter-spacing: .2em;
		}
	}
</style>
<h1 class="title">Breaking Bad</h1>
<h2 class="sub-title">Characters</h2>
<Search {names} on:character={showCharacter}/>
{#if data }
<Character {person}/> 
{/if}