# THE TABLE

El registro oficial de las decisiones cuestionables de Juanse vs Tommy: partidas, apuestas que escalan, deudas y la evidencia para discutir quién debía qué.

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, Supabase/PostgreSQL y Vercel. La interfaz está hecha a medida; no usa un UI kit.

## Empezar

```bash
npm install
cp .env.example .env.local
npm run dev
```

Para desarrollo visual sin Supabase, la app usa `localStorage` automáticamente. El botón **Cargar una noche de ejemplo** no escribe en producción por sí solo: solo carga la historia demo en el almacén activo.

## Supabase

1. Crea un proyecto de Supabase.
2. Ejecuta `supabase/migrations/202608180001_initial_schema.sql` en el SQL Editor (o con la CLI de Supabase).
3. Ejecuta `supabase/seed.sql` para Juanse y Tommy.
4. Copia el Project URL y la anon key a `.env.local`:

```text
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

La app nunca usa una service-role key. El MVP tiene RLS habilitado, pero sus políticas anon permiten leer y escribir a cualquiera que conozca la URL; esto está documentado deliberadamente porque la app es privada por URL. Antes de hacerla pública, sustituye esas políticas por autenticación y políticas por usuario/grupo.

### Regla de apuestas

Una apuesta abierta tiene un único importe actual. `x2`, `x3` o un multiplicador personalizado reemplazan ese importe: no crean una deuda adicional. La partida marcada como decisiva cierra la apuesta y crea una transacción de deuda para quien pierde. `bet_events` conserva el recorrido completo. Es una regla explícita y aislada en `src/lib/bets/engine.ts` para poder cambiarla más adelante.

## Comandos

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

`npm test` ejecuta seis pruebas unitarias sin depender de un navegador: apuesta base, doble, triple, cadena histórica, pago sin borrar historia y recálculo de estadísticas entre sesiones.

## Arquitectura

- `src/lib/bets`: motor determinista de apuestas y deudas.
- `src/lib/stats`: cálculos de rivalidad y Bad Decisions Index.
- `src/lib/data`: borde de persistencia Supabase/localStorage y datos demo.
- `src/app`: experiencia mobile-first, PWA y presentación.
- `supabase`: esquema, índices, RLS y seed.

Las acciones son optimistas. En caso de mala señal, el estado de la pantalla se mantiene y se muestra un mensaje claro; la capa de datos usa upserts idempotentes, por lo que es apta para incorporar una cola offline en una iteración posterior.

## Vercel

Importa el repositorio en Vercel, añade las dos variables `NEXT_PUBLIC_SUPABASE_*` y despliega. No requiere rutas locales ni secretos de servidor. El manifest, icono, theme color y viewport están incluidos para añadirla a la pantalla de inicio de iPhone.
