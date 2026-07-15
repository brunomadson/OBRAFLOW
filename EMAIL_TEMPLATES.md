# Templates de e-mail — Supabase Dashboard

Correção definitiva do bug de convite/recuperação de senha (ver comentário
em `src/app/auth/callback/route.ts` pra o histórico completo da
investigação). Causa raiz confirmada: o formato padrão de link da Supabase
(`{{ .ConfirmationURL }}`) usa `#access_token=...` — um navegador embutido
de app (confirmado com o Gmail, print real do usuário) descarta esse
pedaço da URL ao seguir o redirecionamento. O formato `token_hash` abaixo
não depende disso — é parte normal da URL (depois de `?`), chega ao
servidor sempre, em qualquer navegador.

**Onde editar**: Supabase Dashboard → seu projeto → Authentication →
Email Templates. Edite os 4 templates abaixo (campo "Message body",
formato HTML).

Sem essa edição no Dashboard, o código novo não tem efeito nenhum — o
e-mail continua saindo no formato antigo até isso ser trocado aqui.

---

## Confirm signup

Usado tanto no cadastro normal (`/cadastro`) quanto quando alguém aceita
um convite pela primeira vez (e-mail novo) — não precisa mexer em nada
além do link, o destino certo já vem embutido em `{{ .RedirectTo }}`.

```html
<h2>Confirme seu cadastro</h2>
<p>Siga o link abaixo para confirmar seu e-mail:</p>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup&redirect_to={{ .RedirectTo }}">Confirmar e-mail</a></p>
```

## Magic Link

Cai aqui quando o convite é pra um e-mail que já tem conta (raro, mas
possível).

```html
<h2>Seu link de acesso</h2>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink&redirect_to={{ .RedirectTo }}">Entrar no ObraFlow</a></p>
```

## Reset Password

```html
<h2>Redefinir senha</h2>
<p>Siga o link abaixo para criar uma nova senha:</p>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&redirect_to={{ .RedirectTo }}">Redefinir senha</a></p>
```

## Invite User

Não usado pelo código hoje (o convite de membro passa por "Confirm
signup"/"Magic Link" acima, via `signInWithOtp`), mas deixa correto por
consistência, caso decidam usar `admin.inviteUserByEmail` no futuro.

```html
<h2>Você foi convidado</h2>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite&redirect_to={{ .RedirectTo }}">Aceitar convite</a></p>
```

---

## Depois de editar

Teste com um convite real (ou recuperação de senha) — o link agora deve
ter `?token_hash=...&type=...&redirect_to=...` em vez de `#access_token=`.
Funciona em qualquer navegador, inclusive o embutido do Gmail/apps.
