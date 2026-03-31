# License Manager (Proyecto separado)

Herramienta offline para emitir y administrar licencias compatibles con el backend de `pos_api`.

## Requisitos
- Node.js 18+

## Uso rapido
```bash
cd license_manager
npm install
node src/cli.js help
```

## Panel web local
Levanta una interfaz web para gestionar licencias:
```bash
cd license_manager
npm run web
```
Abre en navegador:
```text
http://127.0.0.1:8787
```

Tambien puedes iniciarlo desde CLI:
```bash
node src/cli.js web --port 8787 --host 127.0.0.1
```

## Flujo recomendado
1. Generar claves (una vez):
```bash
node src/cli.js keygen --out ./keys
```

2. Obtener variable para backend:
```bash
node src/cli.js public-env --public ./keys/license-public.pem
```
Copia la salida y pégala en `LICENSE_PUBLIC_KEY_PEM` del entorno del API.

3. Emitir licencia desde una solicitud de activación del cliente:
```bash
node src/cli.js issue \
  --private ./keys/license-private.pem \
  --request ./samples/activation-request.json \
  --license-id LIC-2026-0001 \
  --days 365 \
  --customer "Cliente Demo" \
  --max-users 15 \
  --features tpv,direct-sales,reports \
  --out ./out/LIC-2026-0001.dat \
  --db ./data/licenses.json
```

4. Verificar archivo de licencia:
```bash
node src/cli.js verify \
  --public ./keys/license-public.pem \
  --license ./out/LIC-2026-0001.dat
```

5. Ver licencias emitidas:
```bash
node src/cli.js list --db ./data/licenses.json
```

6. Revocar en tu registro local:
```bash
node src/cli.js revoke --license-id LIC-2026-0001 --reason "Incumplimiento" --db ./data/licenses.json
```

## Notas
- La revocación aquí es administrativa local (no fuerza invalidación remota offline por sí sola).
- La licencia emitida es JSON firmado (`alg: Ed25519`) con payload compatible con `pos_api`.
- Mantén `license-private.pem` fuera de servidores cliente.
