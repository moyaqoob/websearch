import * as cheerio from 'cheerio'

const EVERY_BASE = 'https://every.to'

function saySomething(){
  let greeting = "Howdy";
  {
    let greeting = "Hi";
    console.log(greeting);
  }
  greeting = "Hello";
  console.log(greeting);
}
saySomething()