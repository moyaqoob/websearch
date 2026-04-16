import 'dotenv/config';
import { D2Client } from "../indexer/client";
async function query(){
  const d2 = new D2Client();
  console.log("hi there")

  const parse =await d2.query('select count(*) from articles;')
  console.log("parse",parse)
  return parse;
}

query();
