import * as cheerio from "cheerio"


function extractPage(url:string){
    const $ = cheerio.load(url)
    $('h1-title')
    

}