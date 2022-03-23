<script>
    let character = "volvo";
 function search() {
     console.log(character)
 }
</script>

<style>
    .search-container {
        margin: 0 auto;
        margin-top: 20px;
        padding: 20px;
        display: flex;
        justify-content: center;
        align-items: center;
    }
    .selector {
        padding: 10px 20px;
        border-radius: 15px;
        border: none;
        background-color: #F9F9F9; 
        transition: .2s;
    }
    .selector:hover {
        background-color: #A9A9A9; 
        color: white;
    }
    .submit_btn {
        padding: 10px 20px;
        color: #F9F9F9;
        background-color: #0000CD;
        text-align: center;
        margin-left: 20px;
        border: none;
        border-radius: 15px;
        transition: .2s;
    }
    .submit_btn:hover {
        background-color: #1919f8;
        color: white;
    }
</style>
<div class="search-container">
<select name="cars" id="cars" class="selector" bind:value={character}>
    <option value="volvo">Volvo</option>
    <option value="saab">Saab</option>
    <option value="mercedes">Mercedes</option>
    <option value="audi">Audi</option>
</select>
<button class="submit_btn" on:click={search}>Search</button>
</div>