import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl, FormControlLabel, Checkbox, Grid, InputLabel, MenuItem, Select, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import SavingsIcon from '@mui/icons-material/Savings';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { abrirCaixa, alternarOperadorCaixa, fecharCaixa, fetchCaixaAtual, fetchOperadoresCaixa, fetchRelatorioCaixa, movimentarCaixa, salvarOperadorCaixa } from '../services/api';

const getRestauranteId = () => localStorage.getItem('_id') || localStorage.getItem('restauranteId') || '';
const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const maskBRLInput = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  const n = Number(digits) / 100;
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const today = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const dateBR = (v) => {
  const s = String(v || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y,m,d] = s.split('-');
    return `${d}/${m}/${y}`;
  }
  return v ? new Date(v).toLocaleDateString('pt-BR') : '-';
};

function Kpi({ label, value }) {
  return <Card sx={{ borderRadius: 4, boxShadow: '0 16px 40px rgba(15,23,42,.08)' }}><CardContent><Typography sx={{ color:'#64748b', fontWeight:800, fontSize:12 }}>{label}</Typography><Typography sx={{ fontSize:26, fontWeight:950 }}>{value}</Typography></CardContent></Card>;
}

export default function Caixa() {
  const restauranteId = getRestauranteId();
  const [tab, setTab] = useState(0);
  const [operadores, setOperadores] = useState([]);
  const [caixa, setCaixa] = useState(null);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  const [operadorForm, setOperadorForm] = useState({ id:'', nome:'', apelido:'', pin:'', permissoes:{abrirCaixa:true,fecharCaixa:true,movimentarCaixa:true,visualizarRelatorios:true} });
  const [abrirForm, setAbrirForm] = useState({ operadorId:'', pin:'', saldoInicial:'0', dataOperacional: today(), observacaoAbertura:'' });
  const [movForm, setMovForm] = useState({ tipo:'sangria', valor:'', descricao:'' });
  const [fecharOpen, setFecharOpen] = useState(false);
  const [fecharForm, setFecharForm] = useState({ pin:'', saldoFinalInformado:'', observacaoFechamento:'' });
  const [relTipo, setRelTipo] = useState('data');
  const [relInicio, setRelInicio] = useState(today());
  const [relFim, setRelFim] = useState(today());
  const [rel, setRel] = useState(null);

  const carregar = useCallback(async () => {
    if (!restauranteId) return;
    try {
      const [op, cx] = await Promise.all([fetchOperadoresCaixa(restauranteId), fetchCaixaAtual(restauranteId)]);
      setOperadores(op.data?.operadores || []);
      setCaixa(cx.data?.caixa || null);
    } catch (e) { setErro(e.response?.data?.message || 'Erro ao carregar caixa.'); }
  }, [restauranteId]);

  const carregarRelatorio = useCallback(async () => {
    if (!restauranteId) return;
    const out = await fetchRelatorioCaixa(restauranteId, { tipo: relTipo, inicio: relInicio, fim: relFim });
    setRel(out.data);
  }, [restauranteId, relTipo, relInicio, relFim]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { if (tab === 2) carregarRelatorio().catch(()=>{}); }, [tab, carregarRelatorio]);

  const operadoresAtivos = useMemo(() => operadores.filter(o => o.ativo !== false), [operadores]);
  const operadorSelecionado = useMemo(() => operadores.find(o => String(o._id) === String(abrirForm.operadorId)), [operadores, abrirForm.operadorId]);
  const aberturaExigePin = !!String(operadorSelecionado?.pin || '').trim();
  const fechamentoExigePin = !!String(caixa?.operador?.pin || caixa?.operadorPin || operadores.find(o => String(o._id) === String(caixa?.operadorId))?.pin || '').trim();
  const caixaAberto = !!caixa && caixa.status === 'aberto';

  async function onSalvarOperador() {
    setErro(''); setMsg('');
    try {
      await salvarOperadorCaixa(restauranteId, operadorForm, operadorForm.id || undefined);
      setOperadorForm({ id:'', nome:'', apelido:'', pin:'', permissoes:{abrirCaixa:true,fecharCaixa:true,movimentarCaixa:true,visualizarRelatorios:true} });
      setMsg('Operador salvo com sucesso.');
      carregar();
    } catch (e) { setErro(e.response?.data?.message || 'Erro ao salvar operador.'); }
  }

  async function onAbrir() {
    setErro(''); setMsg('');
    try {
      await abrirCaixa(restauranteId, abrirForm);
      setAbrirForm({ operadorId:'', pin:'', saldoInicial:'0', dataOperacional: today(), observacaoAbertura:'' });
      setMsg('Caixa aberto com sucesso.');
      carregar();
    } catch (e) { setErro(e.response?.data?.message || 'Erro ao abrir caixa.'); }
  }

  async function onMovimento() {
    setErro(''); setMsg('');
    try {
      await movimentarCaixa(restauranteId, movForm);
      setMovForm({ tipo:'sangria', valor:'', descricao:'' });
      setMsg('Movimento registrado.');
      carregar();
    } catch (e) { setErro(e.response?.data?.message || 'Erro ao registrar movimento.'); }
  }

  async function onFechar() {
    setErro(''); setMsg('');
    try {
      await fecharCaixa(restauranteId, fecharForm);
      setFecharOpen(false);
      setFecharForm({ pin:'', saldoFinalInformado:'', observacaoFechamento:'' });
      setMsg('Caixa fechado com sucesso.');
      carregar();
    } catch (e) { setErro(e.response?.data?.message || 'Erro ao fechar caixa.'); }
  }

  return <Box sx={{ p: 3, background:'linear-gradient(180deg,#fff8fc,#f8fafc)', minHeight:'100vh' }}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
      <Box><Typography sx={{ fontSize: 34, fontWeight: 950, letterSpacing:-1 }}>Caixa</Typography><Typography sx={{ color:'#64748b', fontWeight:700 }}>Abertura, fechamento, operadores e relatórios financeiros.</Typography></Box>
      <Chip icon={<PointOfSaleIcon />} label={caixaAberto ? `Aberto • ${caixa.operadorNome}` : 'Caixa fechado'} color={caixaAberto ? 'success' : 'default'} sx={{ fontWeight:900, p:2 }} />
    </Stack>
    {msg && <Alert severity="success" sx={{ mb:2 }} onClose={()=>setMsg('')}>{msg}</Alert>}
    {erro && <Alert severity="error" sx={{ mb:2 }} onClose={()=>setErro('')}>{erro}</Alert>}

    <Tabs value={tab} onChange={(_,v)=>setTab(v)} sx={{ mb:3 }}>
      <Tab label="Operação" />
      <Tab label="Operadores" />
      <Tab label="Relatórios" />
    </Tabs>

    {tab === 0 && <Grid container spacing={2}>
      <Grid item xs={12} md={8}><Card sx={{ borderRadius:5 }}><CardContent>
        <Stack direction="row" alignItems="center" spacing={1}><PointOfSaleIcon/><Typography sx={{ fontWeight:950, fontSize:22 }}>Sessão atual</Typography></Stack><Divider sx={{ my:2 }} />
        {caixaAberto ? <>
          <Grid container spacing={2} sx={{ mb:2 }}>
            <Grid item xs={6} md={3}><Kpi label="Vendas" value={money(caixa.totalVendas)} /></Grid>
            <Grid item xs={6} md={3}><Kpi label="Dinheiro" value={money(caixa.totalDinheiro)} /></Grid>
            <Grid item xs={6} md={3}><Kpi label="PIX" value={money(caixa.totalPix)} /></Grid>
            <Grid item xs={6} md={3}><Kpi label="Cartões" value={money(Number(caixa.totalCredito||0)+Number(caixa.totalDebito||0))} /></Grid>
            <Grid item xs={6} md={3}><Kpi label="Sangrias" value={money(caixa.totalSangrias)} /></Grid>
            <Grid item xs={6} md={3}><Kpi label="Suprimentos" value={money(caixa.totalSuprimentos)} /></Grid>
            <Grid item xs={12} md={6}><Kpi label="Esperado em dinheiro" value={money(caixa.totalEsperadoDinheiro)} /></Grid>
          </Grid>
          <Typography sx={{ color:'#64748b', fontWeight:700 }}>Data operacional {dateBR(caixa.dataOperacional)} • Aberto em {new Date(caixa.abertoEm).toLocaleString('pt-BR')} por {caixa.operadorNome}</Typography>
          <Stack direction="row" spacing={1} sx={{ mt:2 }}><Button variant="outlined" onClick={carregar}>Atualizar</Button><Button variant="contained" color="error" onClick={()=>setFecharOpen(true)}>Fechar caixa</Button></Stack>
        </> : <>
          <Alert severity="warning" sx={{ mb:2 }}>Para vender no balcão ou aceitar pedidos da vitrine, abra o caixa.</Alert>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}><FormControl fullWidth><InputLabel>Operador</InputLabel><Select label="Operador" value={abrirForm.operadorId} onChange={e=>setAbrirForm(f=>({...f, operadorId:e.target.value, pin:''}))}>{operadoresAtivos.map(o=><MenuItem key={o._id} value={o._id}>{o.nome}{String(o.pin || '').trim() ? ' • PIN' : ''}</MenuItem>)}</Select></FormControl></Grid>
            {aberturaExigePin && <Grid item xs={6} md={2}><TextField fullWidth type="password" label="PIN do operador" value={abrirForm.pin} onChange={e=>setAbrirForm(f=>({...f, pin:e.target.value.replace(/\D/g,'').slice(0,8)}))}/></Grid>}
            <Grid item xs={6} md={2.5}><TextField fullWidth type="date" label="Data operacional" InputLabelProps={{shrink:true}} value={abrirForm.dataOperacional} onChange={e=>setAbrirForm(f=>({...f, dataOperacional:e.target.value}))}/></Grid>
            <Grid item xs={6} md={2.5}><TextField fullWidth label="Troco inicial" value={abrirForm.saldoInicial} onChange={e=>setAbrirForm(f=>({...f, saldoInicial:maskBRLInput(e.target.value)}))}/></Grid>
            <Grid item xs={12} md={3}><TextField fullWidth label="Observação" value={abrirForm.observacaoAbertura} onChange={e=>setAbrirForm(f=>({...f, observacaoAbertura:e.target.value}))}/></Grid>
          </Grid>
          <Button sx={{ mt:2 }} variant="contained" disabled={!abrirForm.operadorId || (aberturaExigePin && !abrirForm.pin)} onClick={onAbrir}>Abrir caixa</Button>
        </>}
      </CardContent></Card></Grid>
      <Grid item xs={12} md={4}><Card sx={{ borderRadius:5 }}><CardContent><Stack direction="row" spacing={1} alignItems="center"><SavingsIcon/><Typography sx={{ fontWeight:950, fontSize:20 }}>Sangria / Suprimento</Typography></Stack><Divider sx={{ my:2 }}/><Stack spacing={2}><FormControl fullWidth><InputLabel>Tipo</InputLabel><Select label="Tipo" value={movForm.tipo} onChange={e=>setMovForm(f=>({...f, tipo:e.target.value}))}><MenuItem value="sangria">Sangria</MenuItem><MenuItem value="suprimento">Suprimento</MenuItem></Select></FormControl><TextField label="Valor" value={movForm.valor} onChange={e=>setMovForm(f=>({...f, valor:maskBRLInput(e.target.value)}))}/><TextField label="Motivo/descrição" value={movForm.descricao} onChange={e=>setMovForm(f=>({...f, descricao:e.target.value}))}/><Button disabled={!caixaAberto} variant="contained" onClick={onMovimento}>Registrar</Button></Stack></CardContent></Card></Grid>
    </Grid>}

    {tab === 1 && <Grid container spacing={2}><Grid item xs={12} md={5}><Card sx={{ borderRadius:5 }}><CardContent><Stack direction="row" spacing={1} alignItems="center"><PersonAddAlt1Icon/><Typography sx={{ fontWeight:950, fontSize:20 }}>{operadorForm.id?'Editar operador':'Cadastrar operador'}</Typography></Stack><Divider sx={{ my:2 }}/><Stack spacing={2}><TextField label="Nome" value={operadorForm.nome} onChange={e=>setOperadorForm(f=>({...f,nome:e.target.value}))}/><TextField label="Apelido" value={operadorForm.apelido} onChange={e=>setOperadorForm(f=>({...f,apelido:e.target.value}))}/><TextField label="PIN opcional" value={operadorForm.pin} onChange={e=>setOperadorForm(f=>({...f,pin:e.target.value.replace(/\D/g,'').slice(0,8)}))}/><Box><Typography sx={{fontWeight:900,mb:1}}>Permissões</Typography>{[['abrirCaixa','Abrir caixa'],['fecharCaixa','Fechar caixa'],['movimentarCaixa','Sangria e suprimento'],['visualizarRelatorios','Visualizar relatórios']].map(([key,label])=><FormControlLabel key={key} control={<Checkbox checked={operadorForm.permissoes?.[key]!==false} onChange={e=>setOperadorForm(f=>({...f,permissoes:{...(f.permissoes||{}),[key]:e.target.checked}}))}/>} label={label}/>)}</Box><Stack direction="row" spacing={1}><Button variant="contained" onClick={onSalvarOperador}>{operadorForm.id?'Atualizar operador':'Salvar operador'}</Button>{operadorForm.id&&<Button onClick={()=>setOperadorForm({id:'',nome:'',apelido:'',pin:'',permissoes:{abrirCaixa:true,fecharCaixa:true,movimentarCaixa:true,visualizarRelatorios:true}})}>Cancelar</Button>}</Stack></Stack></CardContent></Card></Grid><Grid item xs={12} md={7}><Card sx={{ borderRadius:5 }}><CardContent><Typography sx={{ fontWeight:950, fontSize:20, mb:2 }}>Operadores cadastrados</Typography><Stack spacing={1}>{operadores.map(o=><Card key={o._id} variant="outlined" sx={{ borderRadius:3 }}><CardContent sx={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}><Box><Typography sx={{ fontWeight:900 }}>{o.nome}</Typography><Typography sx={{ color:'#64748b' }}>{o.apelido || 'Sem apelido'} • {o.ativo === false ? 'Inativo' : 'Ativo'}</Typography></Box><Stack direction="row" spacing={1}><Button onClick={()=>setOperadorForm({id:o._id,nome:o.nome||'',apelido:o.apelido||'',pin:o.pin||'',permissoes:{abrirCaixa:o.permissoes?.abrirCaixa!==false,fecharCaixa:o.permissoes?.fecharCaixa!==false,movimentarCaixa:o.permissoes?.movimentarCaixa!==false,visualizarRelatorios:o.permissoes?.visualizarRelatorios!==false}})}>Editar</Button><Button onClick={async()=>{await alternarOperadorCaixa(restauranteId,o._id,!(o.ativo!==false)); carregar();}}>{o.ativo === false ? 'Ativar' : 'Inativar'}</Button></Stack></CardContent></Card>)}</Stack></CardContent></Card></Grid></Grid>}

    {tab === 2 && <Card sx={{ borderRadius:5 }}><CardContent><Stack direction="row" spacing={1} alignItems="center"><AssessmentIcon/><Typography sx={{ fontWeight:950, fontSize:22 }}>Relatórios</Typography></Stack><Divider sx={{ my:2 }}/><Grid container spacing={2} alignItems="center"><Grid item xs={12} md={3}><FormControl fullWidth><InputLabel>Tipo</InputLabel><Select label="Tipo" value={relTipo} onChange={e=>setRelTipo(e.target.value)}><MenuItem value="data">Por data</MenuItem><MenuItem value="caixa">Por caixa</MenuItem><MenuItem value="operador">Por operador</MenuItem></Select></FormControl></Grid><Grid item xs={6} md={3}><TextField fullWidth type="date" label="Início" InputLabelProps={{shrink:true}} value={relInicio} onChange={e=>setRelInicio(e.target.value)}/></Grid><Grid item xs={6} md={3}><TextField fullWidth type="date" label="Fim" InputLabelProps={{shrink:true}} value={relFim} onChange={e=>setRelFim(e.target.value)}/></Grid><Grid item xs={12} md={3}><Button fullWidth variant="contained" onClick={carregarRelatorio}>Gerar relatório</Button></Grid></Grid>{rel && <><Grid container spacing={2} sx={{ mt:1 }}>{[['Vendas',rel.resumo.totalVendas],['Dinheiro',rel.resumo.dinheiro],['PIX',rel.resumo.pix],['Crédito',rel.resumo.credito],['Débito',rel.resumo.debito],['Online',rel.resumo.online],['Sangrias',rel.resumo.sangrias],['Suprimentos',rel.resumo.suprimentos]].map(([l,v])=><Grid item xs={6} md={3} key={l}><Kpi label={l} value={money(v)} /></Grid>)}</Grid><Stack spacing={1} sx={{ mt:2 }}>{rel.linhas.map(r=><Card key={r.chave} variant="outlined" sx={{ borderRadius:3 }}><CardContent><Stack direction="row" justifyContent="space-between"><Box><Typography sx={{ fontWeight:950 }}>{r.label}</Typography><Typography sx={{ color:'#64748b' }}>{r.caixas} caixa(s) • {r.pedidos} pedido(s)</Typography></Box><Typography sx={{ fontWeight:950, fontSize:22 }}>{money(r.totalVendas)}</Typography></Stack></CardContent></Card>)}</Stack></>}</CardContent></Card>}

    <Dialog open={fecharOpen} onClose={()=>setFecharOpen(false)} maxWidth="sm" fullWidth><DialogTitle>Fechar caixa</DialogTitle><DialogContent><Stack spacing={2} sx={{ mt:1 }}><Alert severity="info">Confira o dinheiro físico e informe o saldo final contado.</Alert>{fechamentoExigePin && <TextField type="password" label="PIN do operador" value={fecharForm.pin} onChange={e=>setFecharForm(f=>({...f,pin:e.target.value.replace(/\D/g,'').slice(0,8)}))}/>}<TextField label="Saldo final contado" value={fecharForm.saldoFinalInformado} onChange={e=>setFecharForm(f=>({...f,saldoFinalInformado:maskBRLInput(e.target.value)}))}/><TextField label="Observação" multiline minRows={3} value={fecharForm.observacaoFechamento} onChange={e=>setFecharForm(f=>({...f,observacaoFechamento:e.target.value}))}/></Stack></DialogContent><DialogActions><Button onClick={()=>setFecharOpen(false)}>Cancelar</Button><Button color="error" variant="contained" disabled={fechamentoExigePin && !fecharForm.pin} onClick={onFechar}>Confirmar fechamento</Button></DialogActions></Dialog>
  </Box>;
}
