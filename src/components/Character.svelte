<script>
    let person = {char_id: 1, name: 'Walter White', birthday: '09-07-1958', occupation: ["Server", "Good Man"], img: "https://images.amcnetworks.com/amc.com/wp-content/uploads/2015/04/cast_bb_700x1000_walter-white-lg.jpg", nickname: "Rayyanes", status: "Dead"}
    let name = person.name;
    let birthday = person.birthday;
    let occupations = person.occupation;
    let img = person.img;
    let nickname = person.nickname;
    let status = person.status;

</script>

<style>
    .profolio {
        padding: 20px;
        margin-top: 20px;
        width: 100%;
        text-align: center;
    }
    .container {
        display: flex;
        justify-content: center;
    }
    h1, h2,  p {
        margin-bottom: 10px;
    }
    h1 {
        font-size: 1.6em;
        color: #0000CD;
    }
    h2 {
        font-size: 1.3em;
        color: #FFD700;
    }
     p {
        color: #A9A9A9;
        font-size: .9em;
        font-weight: 600;
        display: block;
    }
    img {
        width: 100%;
        max-width: 800px;

        margin: 20px 0;
        height: auto;
    }
    @media only screen and (max-width: 600px) {
        h1 {
            font-size: 1.3em;
        }
        h2 {
            font-size: 1.1em;
        }
         p {
            font-size: .7em;
        }

    }
</style>
<div class="container">
    {#if person}
<div class="profolio">
    <h1 class="name">{name}</h1>
    <h2 class="birthday">{birthday}</h2>
    <img src={img} alt={name}>
    <h1 class="title">More: </h1>
    <h2 class="nickname">Nickname:</h2>
    <p>{nickname}</p>
    <h2 class="sub-title">Ocuupations: </h2>
    {#each occupations as occupation}
    <p class="occupation">{occupation}</p>
    {/each}
    <h2 class="status">Status: </h2>
    <p>{status}</p>
</div>
{:else}
<h1>No person showed</h1>
{/if}
</div> 