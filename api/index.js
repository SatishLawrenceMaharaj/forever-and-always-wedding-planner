// Vercel Node.js Function entry point. The vercel.json rewrite preserves original paths in ?route=.
import {handle} from '../lib/app.js';
export default async function handler(req,res){await handle(req,res);}
