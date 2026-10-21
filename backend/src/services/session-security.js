const {randomBytes,scrypt:derive,createHash,timingSafeEqual}=require('node:crypto');
const {promisify}=require('node:util');
const scrypt=promisify(derive);
const digest=value=>createHash('sha256').update(value).digest('hex');
async function hashPassword(password){
 if(typeof password!=='string'||password.length<8||password.length>128) throw new Error('كلمة المرور يجب أن تكون 8 أرقام/أحرف على الأقل');
 const salt=randomBytes(16).toString('hex');
 return `scrypt:${salt}:${(await scrypt(password,salt,64)).toString('hex')}`;
}
async function verifyPassword(password,stored){
 if(typeof password!=='string'||password.length>128||typeof stored!=='string') return false;
 const [kind,salt,encoded]=stored.split(':'); if(kind!=='scrypt'||!salt||!encoded) return false;
 const actual=await scrypt(password,salt,64),expected=Buffer.from(encoded,'hex');
 return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
module.exports={hashPassword,verifyPassword,digest,newToken:()=>randomBytes(32).toString('base64url')};
