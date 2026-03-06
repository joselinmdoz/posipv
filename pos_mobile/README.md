# POS Mobile (Ionic + Angular + Capacitor)

Base inicial de app movil para el proyecto POS iPV.

## Requisitos en Ubuntu

- Node.js 20+
- npm 10+
- Java 17
- Android Studio (SDK Manager + Android SDK Platform + Emulator)
- `adb` disponible en `PATH`

## Configuracion rapida

```bash
cd pos_mobile
npm install
```

## Desarrollo web (rápido)

```bash
npm run ionic:serve
```

## Flujo Android

1) Compilar web:

```bash
npm run ionic:build
```

2) Agregar Android (solo la primera vez):

```bash
npm run android:add
```

3) Sincronizar cambios:

```bash
npm run cap:sync
```

4) Abrir Android Studio:

```bash
npm run android:open
```

## API base por entorno

- Web: `src/environments/environment.ts` -> `webApiBaseUrl` (`/api`)
- Android emulador: `src/environments/environment.ts` -> `nativeApiBaseUrl` (`http://10.0.2.2:3021/api`)
- Produccion movil: `src/environments/environment.prod.ts` -> `nativeApiBaseUrl` (dominio real)

## Nota CORS para backend

Para pruebas moviles, `CORS_ORIGIN` del backend debe incluir `http://localhost` (WebView de Capacitor).
