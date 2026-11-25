"use strict";
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const raiz=path.resolve(__dirname,'..'),pasta=path.join(raiz,'.local');
const privada=path.join(pasta,'update-signing-key.pem'),publica=path.join(raiz,'desktop','update-key.json');
fs.mkdirSync(pasta,{recursive:true});
if(!fs.existsSync(privada)) {
  if(fs.existsSync(publica))throw Error('A chave pública já existe. Recupere a chave privada original; não faça rotação automática.');
  const par=crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(privada,par.privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600,flag:'wx'});
}
const publicKey=crypto.createPublicKey(fs.readFileSync(privada)).export({type:'spki',format:'pem'});
if(fs.existsSync(publica)&&JSON.parse(fs.readFileSync(publica)).publicKey!==publicKey)throw Error('As chaves não correspondem.');
fs.writeFileSync(publica,JSON.stringify({algoritmo:'ed25519',publicKey},null,2)+'\n');
console.log('Chave pública preparada. A chave privada permanece em .local/ e deve ser cadastrada no segredo HUB_UPDATE_PRIVATE_KEY da CI.');
