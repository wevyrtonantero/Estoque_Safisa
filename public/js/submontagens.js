const api='/api/submontagens',itensApi='/api/itens-simples',opcoesApi='/api/opcoes-cadastro';
const $=s=>document.querySelector(s);
let subs=[],comps=[],itens=[],opcoes={materias_primas:[],fornecedores:[],maquinas:[]},atual=null,editSub=null,editComp=null,timer=null;

const el={
 msg:$('#submontagem-mensagem'),msgEstr:$('#estrutura-mensagem'),msgSub:$('#submontagem-modal-mensagem'),msgComp:$('#componente-modal-mensagem'),
 tbody:$('#submontagens-tbody'),ctbody:$('#componentes-tbody'),filtro:$('#submontagem-filtro-form'),
 subModal:$('#submontagem-modal'),compModal:$('#componente-modal'),drawer:$('#app-drawer'),scrim:$('#drawer-scrim')
};

document.addEventListener('DOMContentLoaded',async()=>{bind();await Promise.all([carregarOpcoes(),carregarItens()]);await carregarSubmontagens();});

function bind(){
 $('#btn-nova-submontagem').onclick=abrirNovaSubmontagem;
 $('#btn-novo-componente').onclick=abrirNovoComponente;
 $('#btn-atualizar-submontagem').onclick=atualizarSubmontagem;
 $('#btn-atualizar-componente').onclick=atualizarComponente;
 $('#btn-limpar-filtros-submontagem').onclick=()=>{el.filtro.reset();carregarSubmontagens();};
 $('#btn-cancelar-modal-submontagem').onclick=fecharSubmontagem;
 $('#btn-fechar-modal-submontagem').onclick=fecharSubmontagem;
 $('#btn-cancelar-modal-componente').onclick=fecharComponente;
 $('#btn-fechar-modal-componente').onclick=fecharComponente;
 $('#menu-toggle').onclick=()=>toggleDrawer(true);
 $('#drawer-close').onclick=()=>toggleDrawer(false);
 el.scrim.onclick=()=>toggleDrawer(false);
 el.subModal.onclick=e=>e.target.dataset.closeModal==='submontagem'&&fecharSubmontagem();
 el.compModal.onclick=e=>e.target.dataset.closeModal==='componente'&&fecharComponente();
 document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;hideAllPanels();if(!el.compModal.classList.contains('hidden'))return fecharComponente();if(!el.subModal.classList.contains('hidden'))return fecharSubmontagem();toggleDrawer(false);});
 el.filtro.onsubmit=e=>{e.preventDefault();carregarSubmontagens();};
 el.filtro.querySelectorAll('input,select').forEach(f=>f.oninput=f.onchange=()=>{clearTimeout(timer);timer=setTimeout(carregarSubmontagens,220);});
 $('#submontagem-form').onsubmit=criarSubmontagem;
 $('#componente-form').onsubmit=criarComponente;
 el.tbody.onclick=acaoSubmontagem;
 el.ctbody.onclick=acaoComponente;
 bindLookup('materias_primas','#submontagem-busca-materia-prima','#submontagem-id-materia-prima','#submontagem-sugestoes-materia-prima',i=>`${i.codigo} - ${i.nome}`,i=>`${i.geometria} | ${i.bitola}`);
 bindLookup('fornecedores','#submontagem-busca-fornecedor','#submontagem-id-fornecedor','#submontagem-sugestoes-fornecedor',i=>i.nome,i=>`${i.contato||'-'} | ${i.cidade||'-'}`);
 bindLookup('maquinas','#submontagem-busca-maquina','#submontagem-id-maquina','#submontagem-sugestoes-maquina',i=>i.nome,i=>i.tipo);
 bindItensLookup();
 document.addEventListener('click',e=>{if(!e.target.closest('.autocomplete'))hideAllPanels();});
}

function bindLookup(chave,inputSel,hiddenSel,panelSel,labelFn,descFn){
 const input=$(inputSel),hidden=$(hiddenSel),panel=$(panelSel);
 const render=termo=>{
  const filtro=(termo||'').toLowerCase();
  const lista=(opcoes[chave]||[]).filter(i=>!filtro||Object.values(i).join(' ').toLowerCase().includes(filtro)).slice(0,8);
  panel.innerHTML=lista.length?lista.map(i=>`<button type="button" class="autocomplete-option" data-id="${i.id}"><strong>${esc(labelFn(i))}</strong><span>${esc(descFn(i))}</span></button>`).join(''):'<div class="autocomplete-empty">Nenhum registro encontrado.</div>';
  panel.classList.remove('hidden');
 };
 input.oninput=()=>{hidden.value='';render(input.value.trim());};
 input.onfocus=()=>render(input.value.trim());
 panel.onclick=e=>{const b=e.target.closest('button[data-id]');if(!b)return;const item=(opcoes[chave]||[]).find(i=>Number(i.id)===Number(b.dataset.id));if(!item)return;hidden.value=item.id;input.value=labelFn(item);panel.classList.add('hidden');panel.innerHTML='';};
}

function bindItensLookup(){
 const input=$('#componente-item-busca'),hidden=$('#componente-item-id'),panel=$('#componente-item-sugestoes');
 const render=termo=>{
  const filtro=(termo||'').toLowerCase();
  const lista=itens.filter(i=>!filtro||`${i.codigo} ${i.descricao} ${i.tipo}`.toLowerCase().includes(filtro)).slice(0,8);
  panel.innerHTML=lista.length?lista.map(i=>`<button type="button" class="autocomplete-option" data-id="${i.id}"><strong>${esc(i.codigo)} - ${esc(i.descricao)}</strong><span>${esc(`${i.tipo} | Massa: ${fmt(i.massa_kg||0,3)} kg`)}</span></button>`).join(''):'<div class="autocomplete-empty">Nenhum item simples encontrado.</div>';
  panel.classList.remove('hidden');
 };
 input.oninput=()=>{hidden.value='';render(input.value.trim());};
 input.onfocus=()=>render(input.value.trim());
 panel.onclick=e=>{const b=e.target.closest('button[data-id]');if(!b)return;const item=itens.find(i=>Number(i.id)===Number(b.dataset.id));if(!item)return;hidden.value=item.id;input.value=`${item.codigo} - ${item.descricao}`;panel.classList.add('hidden');panel.innerHTML='';};
}

async function carregarOpcoes(){const r=await fetch(opcoesApi),j=await r.json();if(!r.ok)throwMsg(el.msg,j.message||'Erro ao carregar opcoes.');else opcoes=j;}
async function carregarItens(){const r=await fetch(itensApi),j=await r.json();if(!r.ok)throwMsg(el.msg,j.message||'Erro ao carregar itens.');else itens=j;}

async function carregarSubmontagens(){
 const p=new URLSearchParams(),codigo=$('#filtro-sub-codigo').value.trim(),descricao=$('#filtro-sub-descricao').value.trim(),tipo=$('#filtro-sub-tipo').value;
 if(codigo)p.append('codigo',codigo);if(descricao)p.append('descricao',descricao);if(tipo)p.append('tipo',tipo);
 const r=await fetch(p.toString()?`${api}?${p}`:api),j=await r.json();
 if(!r.ok)return throwMsg(el.msg,j.message||'Erro ao carregar submontagens.');
 subs=j;renderSubs();metrics();
 if(atual){const ok=subs.find(s=>Number(s.id)===Number(atual.id));ok?setAtual(ok,false):limparEstrutura();}
}

function renderSubs(){
 $('#total-submontagens').textContent=`${subs.length} registro(s) encontrado(s)`;
 el.tbody.innerHTML=subs.length?subs.map(s=>`<tr><td class="table-code">${esc(s.codigo)}</td><td class="table-description">${esc(s.descricao)}</td><td>${esc(s.tipo)}</td><td>${int(s.total_componentes||0)}</td><td>${fmt(s.massa_kg||0,3)} kg</td><td class="table-actions-cell"><details class="row-menu"><summary class="row-menu-trigger" aria-label="Abrir acoes">...</summary><div class="row-menu-panel"><button type="button" class="row-menu-item" data-act="estrutura" data-id="${s.id}">Estrutura</button><button type="button" class="row-menu-item" data-act="editar" data-id="${s.id}">Editar</button><button type="button" class="row-menu-item danger" data-act="excluir" data-id="${s.id}">Excluir</button></div></details></td></tr>`).join(''):'<tr><td colspan="6" class="empty-state">Nenhuma submontagem encontrada para os filtros informados.</td></tr>';
}

function metrics(){
 $('#metric-total-submontagens').textContent=String(subs.length);
 $('#metric-total-componentes').textContent=String(subs.reduce((t,s)=>t+Number(s.total_componentes||0),0));
 $('#metric-massa-total').textContent=`${fmt(subs.reduce((t,s)=>t+Number(s.massa_kg||0),0),3)} kg`;
}

async function acaoSubmontagem(e){
 const b=e.target.closest('button[data-act]');if(!b)return;
 const id=Number(b.dataset.id),sub=subs.find(s=>Number(s.id)===id);if(!sub)return;
 if(b.dataset.act==='estrutura')return setAtual(sub,true);
 if(b.dataset.act==='editar')return carregarEdicao(id);
 if(b.dataset.act==='excluir')return excluirSub(id);
}

async function setAtual(sub,carregar){
 atual=sub;$('#btn-novo-componente').disabled=false;
 $('#estrutura-titulo').textContent=`Estrutura de ${sub.codigo}`;
 $('#estrutura-subtitulo').textContent=sub.descricao;
 $('#estrutura-codigo').textContent=`${sub.codigo} - ${sub.descricao}`;
 $('#estrutura-detalhe').textContent=`${sub.tipo} | Componentes cadastrados: ${sub.total_componentes||0}`;
 $('#estrutura-total-componentes').textContent=`Componentes: ${sub.total_componentes||0}`;
 $('#estrutura-massa-total').textContent=`Massa: ${fmt(sub.massa_kg||0,3)} kg`;
 if(!carregar)return;
 const r=await fetch(`${api}/${sub.id}/componentes`),j=await r.json();
 if(!r.ok)return throwMsg(el.msgEstr,j.message||'Erro ao carregar estrutura.');
 comps=j;renderComps();
}

function renderComps(){
 el.ctbody.innerHTML=comps.length?comps.map(c=>`<tr><td class="table-code">${esc(c.codigo_componente)}</td><td class="table-description">${esc(c.descricao_componente)}</td><td>${int(c.quantidade)}</td><td>${esc(c.tipo_componente||'-')}</td><td>${fmt(c.massa_kg||0,3)} kg</td><td class="table-actions-cell"><details class="row-menu"><summary class="row-menu-trigger" aria-label="Abrir acoes">...</summary><div class="row-menu-panel"><button type="button" class="row-menu-item" data-cact="editar" data-id="${c.id_item_componente}">Editar</button><button type="button" class="row-menu-item danger" data-cact="excluir" data-id="${c.id_item_componente}">Excluir</button></div></details></td></tr>`).join(''):'<tr><td colspan="6" class="empty-state">Nenhum componente cadastrado para a submontagem selecionada.</td></tr>';
}

async function acaoComponente(e){
 const b=e.target.closest('button[data-cact]');if(!b||!atual)return;
 const id=Number(b.dataset.id),c=comps.find(x=>Number(x.id_item_componente)===id);if(!c)return;
 if(b.dataset.cact==='editar'){editComp=id;$('#componente-item-id-atual').value=id;$('#componente-item-id').value=id;$('#componente-item-busca').value=`${c.codigo_componente} - ${c.descricao_componente}`;$('#componente-quantidade').value=c.quantidade;$('#componente-observacao').value=c.observacao||'';$('#btn-atualizar-componente').disabled=false;$('#btn-salvar-componente').disabled=true;$('#componente-modal-title').textContent='Editar Componente';$('#componente-modal-subtitle').textContent=`${atual.codigo} - ${atual.descricao}`;return open(el.compModal);}
 if(!confirm('Deseja realmente remover este componente da estrutura?'))return;
 const r=await fetch(`${api}/${atual.id}/componentes/${id}`,{method:'DELETE'}),j=await r.json();if(!r.ok)return throwMsg(el.msgEstr,j.message||'Erro ao remover componente.');show(el.msgEstr,'Componente removido com sucesso.','success');await carregarSubmontagens();await setAtual(atual,true);
}

function abrirNovaSubmontagem(){resetSub();$('#submontagem-modal-title').textContent='Nova Submontagem';open(el.subModal);}
function abrirNovoComponente(){if(!atual)return show(el.msgEstr,'Selecione uma submontagem antes de adicionar componentes.','error');resetComp();$('#componente-modal-title').textContent='Adicionar Componente';$('#componente-modal-subtitle').textContent=`${atual.codigo} - ${atual.descricao}`;open(el.compModal);}
function fecharSubmontagem(){resetSub();close(el.subModal);}
function fecharComponente(){resetComp();close(el.compModal);}

async function criarSubmontagem(e){
 e.preventDefault();if(editSub)return show(el.msgSub,'Use Atualizar para salvar a submontagem em edicao.','error');
 const r=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payloadSub())}),j=await r.json();
 if(!r.ok)return show(el.msgSub,err(j),'error');fecharSubmontagem();show(el.msg,'Submontagem cadastrada com sucesso.','success');await carregarSubmontagens();
}

async function atualizarSubmontagem(){
 if(!editSub)return show(el.msgSub,'Selecione uma submontagem antes de atualizar.','error');
 const id=editSub,r=await fetch(`${api}/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payloadSub())}),j=await r.json();
 if(!r.ok)return show(el.msgSub,err(j),'error');fecharSubmontagem();show(el.msg,'Submontagem atualizada com sucesso.','success');await carregarSubmontagens();if(atual&&Number(atual.id)===Number(id))await setAtual(j,true);
}

async function carregarEdicao(id){
 const r=await fetch(`${api}/${id}`),j=await r.json();if(!r.ok)return show(el.msg,j.message||'Erro ao carregar submontagem.','error');
 editSub=j.id;$('#submontagem-id').value=j.id;$('#submontagem-codigo').value=j.codigo;$('#submontagem-descricao').value=j.descricao;$('#submontagem-comprimento').value=Number(j.comprimento_mm);$('#submontagem-unidade-comprimento').value='mm';$('#submontagem-tipo').value=j.tipo;$('#submontagem-massa').value=Number(j.massa_kg);$('#submontagem-unidade-massa').value='kg';$('#submontagem-estoque-minimo').value=j.estoque_minimo;$('#submontagem-estoque-seguranca').value=j.estoque_seguranca;$('#submontagem-consumo-mensal').value=j.consumo_mensal;
 preencher('materias_primas','#submontagem-id-materia-prima','#submontagem-busca-materia-prima',j.id_materia_prima,i=>`${i.codigo} - ${i.nome}`);
 preencher('fornecedores','#submontagem-id-fornecedor','#submontagem-busca-fornecedor',j.id_fornecedor,i=>i.nome);
 preencher('maquinas','#submontagem-id-maquina','#submontagem-busca-maquina',j.id_maquina,i=>i.nome);
 $('#btn-atualizar-submontagem').disabled=false;$('#btn-salvar-submontagem').disabled=true;$('#submontagem-modal-title').textContent=`Editar ${j.codigo}`;open(el.subModal);
}

async function excluirSub(id){
 if(!confirm('Deseja realmente excluir esta submontagem?'))return;
 const r=await fetch(`${api}/${id}`,{method:'DELETE'}),j=await r.json();if(!r.ok)return show(el.msg,j.message||'Erro ao excluir submontagem.','error');
 if(atual&&Number(atual.id)===id)limparEstrutura();show(el.msg,'Submontagem excluida com sucesso.','success');await carregarSubmontagens();
}

async function criarComponente(e){
 e.preventDefault();if(editComp)return show(el.msgComp,'Use Atualizar para salvar o componente em edicao.','error');
 if(!atual)return show(el.msgComp,'Selecione uma submontagem antes de salvar a estrutura.','error');
 const r=await fetch(`${api}/${atual.id}/componentes`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payloadComp())}),j=await r.json();
 if(!r.ok)return show(el.msgComp,err(j),'error');fecharComponente();show(el.msgEstr,'Componente adicionado com sucesso.','success');await carregarSubmontagens();await setAtual(atual,true);
}

async function atualizarComponente(){
 if(!editComp||!atual)return show(el.msgComp,'Selecione um componente antes de atualizar.','error');
 const r=await fetch(`${api}/${atual.id}/componentes/${editComp}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payloadComp())}),j=await r.json();
 if(!r.ok)return show(el.msgComp,err(j),'error');fecharComponente();show(el.msgEstr,'Componente atualizado com sucesso.','success');await carregarSubmontagens();await setAtual(atual,true);
}

function payloadSub(){
 return {codigo:$('#submontagem-codigo').value.trim(),descricao:$('#submontagem-descricao').value.trim(),comprimento_mm:mm($('#submontagem-comprimento').value,$('#submontagem-unidade-comprimento').value),tipo:$('#submontagem-tipo').value,id_materia_prima:nv($('#submontagem-id-materia-prima').value),id_fornecedor:nv($('#submontagem-id-fornecedor').value),id_maquina:nv($('#submontagem-id-maquina').value),estoque_minimo:$('#submontagem-estoque-minimo').value,estoque_seguranca:$('#submontagem-estoque-seguranca').value,consumo_mensal:$('#submontagem-consumo-mensal').value,massa_kg:kg($('#submontagem-massa').value,$('#submontagem-unidade-massa').value)};
}

function payloadComp(){return{id_item_componente:$('#componente-item-id').value,quantidade:$('#componente-quantidade').value,observacao:$('#componente-observacao').value.trim()};}
function preencher(chave,hiddenSel,inputSel,id,label){const item=(opcoes[chave]||[]).find(i=>Number(i.id)===Number(id));$(hiddenSel).value=id||'';$(inputSel).value=item?label(item):id?`ID ${id}`:'';}
function resetSub(){$('#submontagem-form').reset();editSub=null;$('#submontagem-id').value='';$('#submontagem-id-materia-prima').value='';$('#submontagem-id-fornecedor').value='';$('#submontagem-id-maquina').value='';$('#submontagem-unidade-comprimento').value='mm';$('#submontagem-unidade-massa').value='kg';$('#submontagem-busca-materia-prima').value='';$('#submontagem-busca-fornecedor').value='';$('#submontagem-busca-maquina').value='';$('#btn-atualizar-submontagem').disabled=true;$('#btn-salvar-submontagem').disabled=false;hide(el.msgSub);hideAllPanels();}
function resetComp(){$('#componente-form').reset();editComp=null;$('#componente-item-id').value='';$('#componente-item-id-atual').value='';$('#componente-item-busca').value='';$('#componente-quantidade').value='1';$('#btn-atualizar-componente').disabled=true;$('#btn-salvar-componente').disabled=false;hide(el.msgComp);hideAllPanels();}
function limparEstrutura(){atual=null;comps=[];$('#btn-novo-componente').disabled=true;$('#estrutura-titulo').textContent='Selecione uma submontagem';$('#estrutura-subtitulo').textContent='Abra a estrutura a partir da listagem para consultar ou editar os componentes.';$('#estrutura-codigo').textContent='Nenhuma submontagem selecionada';$('#estrutura-detalhe').textContent='Escolha um registro para visualizar a composicao.';$('#estrutura-total-componentes').textContent='Componentes: 0';$('#estrutura-massa-total').textContent='Massa: 0,000 kg';renderComps();hide(el.msgEstr);}
function open(m){m.classList.remove('hidden');m.setAttribute('aria-hidden','false');syncBody();}
function close(m){m.classList.add('hidden');m.setAttribute('aria-hidden','true');syncBody();}
function syncBody(){document.body.classList.toggle('has-modal',![el.subModal,el.compModal].every(m=>m.classList.contains('hidden')));}
function toggleDrawer(open){el.drawer.classList.toggle('is-open',!!open);el.scrim.classList.toggle('hidden',!open);document.body.classList.toggle('has-drawer',!!open);}
function hideAllPanels(){document.querySelectorAll('.autocomplete-panel').forEach(p=>{p.classList.add('hidden');p.innerHTML='';});}
function show(box,text,type){box.textContent=text;box.className=`message ${type}`;box.classList.remove('hidden');}
function hide(box){box.className='message hidden';box.textContent='';}
function throwMsg(box,text){show(box,text,'error');}
function err(r){return Array.isArray(r.errors)&&r.errors.length?r.errors.join(' '):(r.message||'Operacao nao concluida.');}
function nv(v){return v===''?null:v;}
function mm(v,u){const n=Number.parseFloat(v);return Number.isFinite(n)?(u==='m'?n*1000:n):n;}
function kg(v,u){const n=Number.parseFloat(v);return Number.isFinite(n)?(u==='g'?n/1000:n):n;}
function fmt(v,c){return Number(v).toLocaleString('pt-BR',{minimumFractionDigits:c,maximumFractionDigits:c});}
function int(v){return Number(v).toLocaleString('pt-BR',{maximumFractionDigits:0});}
function esc(v){return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');}
