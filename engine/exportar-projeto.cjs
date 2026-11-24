"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
// ZIP sem compressão: exportação pequena, offline e sem dependências extras.
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) {
    crc ^= b;
    for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(arquivos) {
  const partes = [],
    central = [];
  let offset = 0;
  for (const [nome, texto] of Object.entries(arquivos)) {
    const nomeBytes = Buffer.from(nome);
    const dados = Buffer.from(texto);
    const crc = crc32(dados);
    const cab = Buffer.alloc(30);
    cab.writeUInt32LE(0x04034b50);
    cab.writeUInt16LE(20, 4);
    cab.writeUInt16LE(0x800, 6);
    cab.writeUInt16LE(33, 12);
    cab.writeUInt32LE(crc, 14);
    cab.writeUInt32LE(dados.length, 18);
    cab.writeUInt32LE(dados.length, 22);
    cab.writeUInt16LE(nomeBytes.length, 26);
    partes.push(cab, nomeBytes, dados);
    const registro = Buffer.alloc(46);
    registro.writeUInt32LE(0x02014b50);
    registro.writeUInt16LE(20, 4);
    registro.writeUInt16LE(20, 6);
    registro.writeUInt16LE(0x800, 8);
    registro.writeUInt16LE(33, 14);
    registro.writeUInt32LE(crc, 16);
    registro.writeUInt32LE(dados.length, 20);
    registro.writeUInt32LE(dados.length, 24);
    registro.writeUInt16LE(nomeBytes.length, 28);
    registro.writeUInt32LE(offset, 42);
    central.push(registro, nomeBytes);
    offset += cab.length + nomeBytes.length + dados.length;
  }
  const tamanho = central.reduce((n, b) => n + b.length, 0);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50);
  fim.writeUInt16LE(Object.keys(arquivos).length, 8);
  fim.writeUInt16LE(Object.keys(arquivos).length, 10);
  fim.writeUInt32LE(tamanho, 12);
  fim.writeUInt32LE(offset, 16);
  return Buffer.concat([...partes, ...central, fim]);
}
const iniciar = `"use strict";
const fs=require('node:fs/promises');const path=require('node:path');
(async()=>{
 const aula=require('./aula.json');const host=await require('./.hub/recursos-host.cjs').abrir({pasta:path.join(__dirname,'.dados'),definicao:aula.ambiente});
 const recursos=require('./.hub/recursos-cliente.cjs').criarCliente(host.conexao);
 const fechar=async()=>{await host.parar();process.exit(0);};process.on('SIGINT',fechar);process.on('SIGTERM',fechar);
 if(aula.modo==='projeto' && aula.projeto.tipo==='http'){
  const compartilhado=host.conexao.recursos.some(r=>r.id==='banco'&&r.tipo==='sqlite'&&r.modo==='arquivo');
  const caminhoBanco=compartilhado?await recursos.sqlite('banco').caminhoArquivo():path.join(__dirname,'hub.sqlite');
  const servidor=await require('./app.cjs').criarServidor({caminhoBanco,recursos});
  servidor.listen(Number(process.env.PORT??3000),'127.0.0.1',()=>console.log('Seu servidor: http://127.0.0.1:'+servidor.address().port));
  process.on('SIGINT',()=>servidor.closeAllConnections());
 }else if(aula.modo==='projeto'){
  const comando=aula.projeto.comandos.find(c=>c.id===(process.argv[2]??aula.projeto.comandos[0].id));if(!comando)throw Error('Comando inexistente.');
  const r=await require('./.hub/oficinas.cjs').comando(__dirname,comando);console.log(r.saida);if(r.aviso)console.error(r.aviso);process.exitCode=r.codigo;await host.parar();
 }else{
  const id=process.argv[2]??aula.exercicios[0].id;const exercicio=aula.exercicios.find(e=>e.id===id);if(!exercicio)throw Error('Atividade inexistente.');
  const codigo=await fs.readFile(path.join(__dirname,'exercicios',id+'.js'),'utf8');
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;await new AsyncFunction('require','recursos',codigo+'\\n'+(exercicio.experimento??''))(require,recursos);await host.parar();
 }
 for(const r of host.conexao.recursos.filter(r=>r.tipo==='mock-http'))console.log('Mock '+r.id+': '+recursos.url(r.id));
})().catch(e=>{console.error(e);process.exit(1);});
`;
const verificar = `"use strict";
const fs=require('node:fs/promises');const path=require('node:path');
(async()=>{const aula=require('./aula.json');let resultados=[];
if(aula.modo==='funcoes'){for(const e of aula.exercicios){const codigo=await fs.readFile(path.join(__dirname,'exercicios',e.id+'.js'),'utf8');resultados.push(...await require('./.hub/avaliacao-ambiente.cjs').avaliarComAmbiente(codigo,e.testes,aula.ambiente));}}
else{const arquivos={};for(const f of aula.projeto.arquivos)arquivos[f.nome]=await fs.readFile(path.join(__dirname,f.nome),'utf8');resultados=aula.projeto.tipo==='http'?await require('./.hub/projetos.cjs').testarProjeto(aula,arquivos):await require('./.hub/oficinas.cjs').testarOficina(aula,arquivos,__dirname);}
for(const r of resultados)console.log((r.passou?'✓ ':'✗ ')+r.nome+(r.passou?'':'\\n'+r.recebido));process.exitCode=resultados.every(r=>r.passou)?0:1;
})().catch(e=>{console.error(e);process.exitCode=1;});
`;
exports.exportar = async function exportar(aula, respostas, ambiente) {
  const publica = Object.fromEntries(
    Object.entries(aula).filter(([k]) => k !== "professor"),
  );
  publica.ambiente = ambiente ??
    publica.ambiente ?? { versao: 1, recursos: [] };
  const arquivos = {
    "aula.json": JSON.stringify(publica, null, 2),
    "iniciar.cjs": iniciar,
    "verificar.cjs": verificar,
    "package.json": JSON.stringify(
      {
        name: "projeto-do-aluno",
        private: true,
        engines: { node: ">=24.13.0" },
        scripts: { start: "node iniciar.cjs", test: "node verificar.cjs" },
      },
      null,
      2,
    ),
  };
  for (const nome of [
    "ambiente-schema.cjs",
    "execucao-isolada.cjs",
    "executor-bootstrap.cjs",
    "ambiente.cjs",
    "ambiente-processo.cjs",
    "recursos-host.cjs",
    "recursos-cliente.cjs",
    "avaliacao-ambiente.cjs",
    "motor-exercicios.cjs",
    "projetos.cjs",
    "projeto-worker.cjs",
    "oficinas.cjs",
  ])
    arquivos[".hub/" + nome] = await fs.readFile(
      path.join(__dirname, nome),
      "utf8",
    );
  if (aula.modo === "projeto")
    for (const f of aula.projeto.arquivos)
      arquivos[f.nome] = respostas.arquivos?.[f.nome] ?? f.codigo;
  else
    for (const e of aula.exercicios)
      arquivos["exercicios/" + e.id + ".js"] =
        respostas.codigos?.[e.id] ?? e.codigoInicial;
  const material = publica.materiaisComplementares ?? {};
  arquivos["LEIA-ME.md"] =
    `# ${aula.titulo}\n\n## Executar sem o Hub\n\n1. Instale Node.js 24.13 ou superior: https://nodejs.org/\n2. Extraia esta pasta e abra-a no VS Code ou outro editor.\n3. No terminal da pasta, execute: node iniciar.cjs\n4. Para conferir os mesmos critérios públicos: node verificar.cjs\n\n${aula.modo === "funcoes" ? "Você também pode escolher uma atividade: node iniciar.cjs ID-DA-ATIVIDADE. Os códigos ficam em exercicios/. O runner fornece recursos por parâmetro; leia iniciar.cjs para entender essa passagem." : aula.projeto.tipo !== "http" ? "Este projeto usa comandos de terminal. Execute node iniciar.cjs ID-DO-COMANDO para escolher um dos comandos definidos em aula.json. Oficinas de Git requerem Git instalado." : "O app.cjs exporta criarServidor({ recursos, caminhoBanco }). O runner fornece os recursos e abre o servidor na porta 3000, configurável por PORT. Use curl, fetch ou seu cliente HTTP. Ctrl+C encerra o processo."}\n\n## O que acompanha o projeto\n\nSeu código atual, critérios públicos e configuração de recursos. Gabaritos privados, chave da OpenAI e dados experimentais dos bancos não são exportados. Os recursos começam com os dados iniciais definidos na aula. A pasta .hub contém apenas JavaScript de apoio, sem dependência do Electron; leia seus arquivos e depois substitua os adaptadores por integrações próprias. Bancos em memória se perdem ao encerrar; bancos em arquivo ficam em .dados/.\n\n## Guia complementar\n\n${material.guia ?? "Antes de alterar o projeto, explique entradas, saídas e estado. Faça uma mudança por vez, observe os erros e escreva casos de fronteira."}\n\n## Próximos passos fora da plataforma\n\n${material.foraDoHub ?? "Recrie uma operação em um projeto Node vazio, escreva um teste com node:test e documente como outra pessoa pode executá-lo."}\n\n## Desafios de transferência\n\n${material.desafiosTransferencia ?? "Troque o domínio dos dados e reproduza a mesma regra sem copiar o código. Acrescente um cenário de erro e um de concorrência."}\n\n## Referências\n\n${(material.referencias ?? []).map((r) => "- " + r.titulo + ": " + r.url).join("\n")}\n`;
  return zip(arquivos);
};
exports.zip = zip;
