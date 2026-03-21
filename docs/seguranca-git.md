# Fluxo Seguro do Projeto

`main` fica como base segura.

`develop` fica para o desenvolvimento continuo.

Antes de alteracoes grandes:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\git-checkpoint.ps1 -Message "checkpoint antes da mudanca"
```

Isso faz:

1. adiciona as alteracoes atuais
2. cria um commit
3. gera um backup local em `backups\*.bundle`

Comandos uteis:

```powershell
git status
git switch develop
git switch main
git log --oneline --decorate -5
git tag --list
```

Para restaurar um backup `.bundle` em outra pasta:

```powershell
git clone caminho-do-arquivo.bundle safisa-restaurado
```
