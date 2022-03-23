<script>
	import { onMount } from 'svelte';
	import Character from "./components/Character.svelte";
	import Search from "./components/Search.svelte";
	let data  = [];
	onMount(async () => {
		const response = await fetch("https://breakingbadapi.com/api/characters")
		data = await response.json();
	})

</script>
<h1>Breaking Bad</h1>
<h2>Characters</h2>
<Search />
<Character />