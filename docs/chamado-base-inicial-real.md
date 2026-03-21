# Chamado

Titulo: Inicializacao da base real de pecas e fornecedores

Objetivo:
- remover dados fakes de fornecedores, maquinas e submontagens
- iniciar a base apenas com as pecas reais enviadas na carga parcial atual
- usar fornecedor real quando a descricao permitir identificacao
- usar `NOTE TESTE` quando nao houver fornecedor identificado
- usar maquina `CNC` e materia-prima generica para todas as pecas `PRODUZIDA`
- carregar estoque inicial somente no `Almoxarifado`

Fonte da carga:
- [initial_real_pecas.txt](/d:/Sistema%20Safisa/database/initial_real_pecas.txt)

Script de aplicacao:
- `npm run seed:real`

Regras iniciais de fornecedor:
- `paraf`, `porca`, `arruela` -> `Trevine Home Center`
- `rolamento` -> `Itatirol`
- `corpo`, `fundicao`, `tijo` -> `Fundicao Tiger`
- `tampa` -> `Prestampas (Cajamar)`
- `mola` -> `Original Molas`
- `mangueira de oleo`, `mangueira de ar` -> `Oliver Plast`
- `suporte` -> `FF Calderaria Equipamentos`
- sem identificacao -> `NOTE TESTE`
