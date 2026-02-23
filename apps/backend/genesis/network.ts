

//worker pool that fetches my page (dude its kinda hard)

async function fetch_Url(url:string){
    const controller = new AbortController()
    const timeout = (()=>controller.abort,3000)
}