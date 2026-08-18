"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Archive, Check, ChevronRight, CircleDollarSign, Dice5, Plus, ReceiptText, Trophy, X } from "lucide-react";
import { computeStats, currentStreak } from "@/lib/stats";
import { createNight, loadData, markPaid, multiplyActiveBet, recordGame, saveData } from "@/lib/data/repository";
import type { Bet, DebtTransaction, Game, NightSetup, PlayerId, Session, TableData } from "@/types";

type View = "table" | "archive" | "tab" | "numbers";
type SheetName = "night" | "winner" | "raise" | "close" | null;
type Stats = ReturnType<typeof computeStats>;
type Side = { id: string; label: string; memberIds: string[] };
type Sides = { a: Side; b: Side };

const dateShort = new Intl.DateTimeFormat("es-EC", { day: "numeric", month: "short" });
const dateLong = new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" });

export default function Home() {
  const [data, setData] = useState<TableData | null>(null);
  const [view, setView] = useState<View>("table");
  const [sheet, setSheet] = useState<SheetName>(null);
  const [settleWinner, setSettleWinner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => { loadData().then(setData).catch((cause: Error) => setError(cause.message)); }, []);

  const update = async (next: TableData, message?: string) => {
    setData(next); setSaving(true); setError("");
    if (message) { setFeedback(message); window.setTimeout(() => setFeedback(""), 1800); }
    try { await saveData(next); }
    catch { setError("La mesa no pudo guardar eso. Intenta otra vez antes de que cambie la versión de la historia."); }
    finally { setSaving(false); }
  };

  if (!data) return <LoadingTable />;

  const activeSession = data.sessions.find((session) => !session.endedAt) ?? data.sessions[0];
  const stats = computeStats(data);
  const context = ({ table: activeSession ? "EN MESA" : "LISTA", archive: "ARCHIVO", tab: "CUENTA", numbers: "NÚMEROS" } as const)[view];

  const openWinner = (settle: boolean) => { setSettleWinner(settle); setSheet("winner"); };
  const registerWinner = (winner: string, loser: string) => {
    if (!activeSession) return;
    const winnerName = playerName(data, winner);
    update(recordGame(data, activeSession.id, winner, loser, settleWinner), settleWinner ? `Resultado final: ${winnerName} ganó. La deuda quedó escrita.` : `${winnerName} se llevó la partida.`);
    setSheet(null);
  };

  return <main className="shell">
    <Header context={context} saving={saving} />
    {error && <div role="alert" className="notice notice-error"><span>{error}</span><button onClick={() => setError("")} aria-label="Cerrar error"><X size={18}/></button></div>}
    {feedback && <div className="notice notice-success" role="status"><Check size={17}/><span>{feedback}</span></div>}

    <div className="view-stage" key={view}>
      {view === "table" && <TableView data={data} active={activeSession} stats={stats} onNew={() => setSheet("night")} onRegister={() => openWinner(false)} onRaise={() => setSheet("raise")} onCloseBet={() => setSheet("close")} />}
      {view === "archive" && <ArchiveView data={data} />}
      {view === "tab" && <TabView data={data} onPaid={(id) => update(markPaid(data, id), "Pago registrado. La historia sigue ahí.")} />}
      {view === "numbers" && <NumbersView stats={stats} />}
    </div>

    <BottomNav view={view} onChange={setView} />

    {sheet === "night" && (
      <NightSheet
        initialNames={{ a: playerName(data, "juanse"), b: playerName(data, "tommy") }}
        onClose={() => setSheet(null)}
        onCreate={(venue, amount, setup) => {
          update(createNight(data, venue, amount, setup), "Mesa armada. Ahora sí, a jugar.");
          setSheet(null);
        }}
      />
    )}
    {sheet === "winner" && activeSession && (
      <WinnerSheet sides={sidesFor(data, activeSession)} settlesBet={settleWinner} onClose={() => setSheet(null)} onWinner={registerWinner} />
    )}
    {sheet === "raise" && activeSession && (
      <RaiseSheet
        active={data.bets.find((bet) => bet.sessionId === activeSession.id && bet.status === "OPEN")}
        onClose={() => setSheet(null)}
        onRaise={(multiplier) => {
          try {
            update(
              multiplyActiveBet(data, activeSession.id, multiplier),
              multiplier === 2
                ? "Doble o nada. Porque claramente aprendimos."
                : multiplier === 3
                  ? "Triple o nada. Esto ya escaló."
                  : `La apuesta ahora vale x${multiplier}.`,
            );
            setSheet(null);
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "No se pudo cambiar la apuesta.");
          }
        }}
      />
    )}
    {sheet === "close" && activeSession && (
      <CloseSheet
        active={data.bets.find((bet) => bet.sessionId === activeSession.id && bet.status === "OPEN")}
        onClose={() => setSheet(null)}
        onConfirm={() => openWinner(true)}
      />
    )}
  </main>;
}

function Header({ context, saving }: { context: string; saving: boolean }) {
  return <header className="masthead"><div className="masthead-copy"><p className="kicker">Registro oficial de decisiones cuestionables</p><h1>THE TABLE</h1></div><div className="masthead-context"><span className={saving ? "status-mark saving" : "status-mark"}/><span>{saving ? "GUARDANDO" : context}</span></div></header>;
}

function BottomNav({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  return <nav aria-label="Navegación principal" className="rail"><NavItem label="Mesa" active={view === "table"} onClick={() => onChange("table")} icon={<Dice5/>}/><NavItem label="Archivo" active={view === "archive"} onClick={() => onChange("archive")} icon={<Archive/>}/><NavItem label="Cuenta" active={view === "tab"} onClick={() => onChange("tab")} icon={<ReceiptText/>}/><NavItem label="Números" active={view === "numbers"} onClick={() => onChange("numbers")} icon={<Trophy/>}/></nav>;
}

function TableView({ data, active, stats, onNew, onRegister, onRaise, onCloseBet }: { data: TableData; active?: Session; stats: Stats; onNew: () => void; onRegister: () => void; onRaise: () => void; onCloseBet: () => void }) {
  if (!active) {
    const juanse = playerName(data, "juanse"); const tommy = playerName(data, "tommy");
    return <section className="clean-state"><div className="empty-poster"><p className="versus-label">{juanse.toUpperCase()} <span>VS</span> {tommy.toUpperCase()}</p><CupRack size="hero"/><h2>LA MESA<br/>ESTÁ LIMPIA.</h2><p className="muted-copy">Por ahora.</p><div className="empty-score" aria-label={`${juanse} cero, ${tommy} cero`}><span><small>{juanse}</small><b>0</b></span><i>—</i><span><small>{tommy}</small><b>0</b></span></div></div><button className="primary mechanical" onClick={onNew}><span>Empezar la primera noche</span><ChevronRight size={20}/></button></section>;
  }

  const sides = sidesFor(data, active); const games = data.games.filter((game) => game.sessionId === active.id); const score = scoreOf(games, sides); const streak = currentStreak(games); const activeBet = data.bets.find((bet) => bet.sessionId === active.id && bet.status === "OPEN"); const streakSide = streak ? sideFor(streak.playerId, sides) : null; const streakName = streakSide ? sides[streakSide].label : "";
  return <section className="table-view"><div className="night-meta"><div><span>NOCHE ACTIVA</span><b>{dateShort.format(new Date(`${active.date}T12:00:00`))} · {active.venue}</b></div><button onClick={onNew}>Nueva noche <Plus size={16}/></button></div><ScoreBoard left={score.a} right={score.b} leftLabel={sides.a.label} rightLabel={sides.b.label} label={active.mode === "2v2" ? "MARCADOR · 2 CONTRA 2" : "MARCADOR DE LA NOCHE"}/><div className="form-strip"><span>{streak ? `${streakName} · ${Array.from({ length: Math.min(streak.count, 5) }).map(() => "G").join(" ")}` : "AÚN SIN RACHA"}</span><p>{tableMicrocopy(score, streak, streakName)}</p></div>{activeBet ? <ActiveBet bet={activeBet}/> : <div className="no-bet"><span>Sin apuesta abierta</span><p>Solo está en juego el orgullo. Por ahora.</p></div>}<div className="table-actions"><button className="primary mechanical register-action" onClick={onRegister}><Trophy/><span>Registrar ganador</span><ChevronRight/></button>{activeBet && <div className="bet-actions"><button className="amber-action" onClick={onRaise}><span>Doble / triple o nada</span><ChevronRight/></button><button className="ledger-action" onClick={onCloseBet}><CircleDollarSign/><span>Cobrar / cerrar deuda</span></button></div>}</div><aside className="rivalry-summary"><span>{active.mode === "2v2" ? "ESTA MESA" : "HISTÓRICO"}</span><b>{active.mode === "2v2" ? `${score.a} — ${score.b}` : `${stats.juanseWins} — ${stats.tommyWins}`}</b><p>{active.mode === "2v2" ? "Cuatro personas. La misma falta de criterio." : rivalryMicrocopy(stats)}</p></aside></section>;
}

function ScoreBoard({ left, right, leftLabel = "JUANSE", rightLabel = "TOMMY", label }: { left: number; right: number; leftLabel?: string; rightLabel?: string; label: string }) {
  return <section className="scoreboard" aria-label={`Marcador: ${leftLabel} ${left}, ${rightLabel} ${right}`}><p>{label}</p><div className="score-grid"><span>{leftLabel.toUpperCase()}</span><strong key={`l-${left}`} className="score-number">{left}</strong><i>—</i><strong key={`r-${right}`} className="score-number">{right}</strong><span>{rightLabel.toUpperCase()}</span></div></section>;
}

function ActiveBet({ bet }: { bet: Bet }) {
  const escalated = bet.currentAmount > bet.initialAmount;
  return <section className="active-bet"><div className="active-bet-top"><span>EN JUEGO</span><span>{escalated ? "APUESTA ESCALADA" : "APUESTA BASE"}</span></div><div className="stake-lockup"><strong key={bet.currentAmount}>{bet.currentAmount}</strong><span>SHOTS</span><CupRack size="stake" count={6}/></div>{escalated && <div className="bet-progression"><span>{bet.initialAmount}</span><i>→</i><b>{bet.currentAmount}</b></div>}<p>Quien pierda la partida decisiva deberá <b>{bet.currentAmount} shots</b>. La deuda cambia de lado con el resultado.</p></section>;
}

function ArchiveView({ data }: { data: TableData }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return <section className="archive-view"><SectionHeading eyebrow="EL ARCHIVO" title={<>NOCHES QUE<br/>LA MESA RECUERDA.</>} />{data.sessions.length === 0 ? <ArchiveEmpty/> : <div className="archive-list">{data.sessions.map((session, index) => {
    const sides = sidesFor(data, session); const games = data.games.filter((game) => game.sessionId === session.id); const score = scoreOf(games, sides); const bet = data.bets.filter((item) => item.sessionId === session.id).at(-1); const record = String(data.sessions.length - index).padStart(3, "0"); const open = expanded === session.id; const events = data.betEvents.filter((event) => data.bets.some((item) => item.id === event.betId && item.sessionId === session.id)); const timeline = [...games.map((game) => ({ at: game.createdAt, label: `${sideFor(game.winnerId, sides) === "a" ? sides.a.label : sides.b.label} gana`, detail: "Partida registrada" })), ...events.map((event) => ({ at: event.createdAt, label: eventLabel(event.type), detail: `${event.amountBefore} → ${event.amountAfter} shots` }))].sort((a, b) => a.at.localeCompare(b.at));
    const betSummary = bet
      ? `${bet.currentAmount} SHOTS · ${bet.status === "OPEN" ? "SIGUEN EN JUEGO" : "CAMBIARON DE MANOS"}`
      : "SOLO ORGULLO · POR SUERTE";
    return <article className={open ? "archive-record open" : "archive-record"} key={session.id}><button className="record-summary" onClick={() => setExpanded(open ? null : session.id)} aria-expanded={open}><span className="record-number">{record}</span><span className="record-body"><small>{dateLong.format(new Date(`${session.date}T12:00:00`)).toUpperCase()}</small><b>{session.venue.toUpperCase()}</b><em>{sides.a.label} <strong>{score.a} — {score.b}</strong> {sides.b.label}</em><span>{betSummary}</span></span><ChevronRight className="record-chevron"/></button>{open && <ol className="record-timeline">{timeline.map((entry, itemIndex) => <li key={`${entry.at}-${itemIndex}`}><time>{new Date(entry.at).toLocaleTimeString("es-EC", { hour: "numeric", minute: "2-digit" })}</time><span><b>{entry.label}</b><small>{entry.detail}</small></span></li>)}</ol>}</article>;
  })}</div>}</section>;
}

function ArchiveEmpty() { return <div className="archive-empty"><p>Todavía no hay nada que negar.</p><div className="ghost-records" aria-hidden="true">{["001", "002", "003"].map((number) => <div key={number}><b>{number}</b><span/><i/><small/></div>)}</div><CupDivider/></div>; }

function TabView({ data, onPaid }: { data: TableData; onPaid: (id: string) => void }) {
  const ledger = [...data.debtTransactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); const current = ledger.find((debt) => debt.status === "OPEN");
  return <section className="tab-view"><SectionHeading eyebrow="LA CUENTA" title={<>BALANCE<br/>ACTUAL</>} />{current ? <CurrentDebt data={data} debt={current} onPaid={() => onPaid(current.id)}/> : <div className="zero-balance"><strong>0</strong><span>SHOTS</span><p>Milagrosamente estamos a paz y salvo.</p><div className="glass-ring" aria-hidden="true"/></div>}<div className="ledger-head"><span>MOVIMIENTOS</span><small>La mesa no borra nada.</small></div>{ledger.length ? <div className="ledger-list">{ledger.map((debt) => <LedgerRow data={data} debt={debt} key={debt.id}/>)}</div> : <div className="empty-ledger"><span>FECHA</span><span>MOVIMIENTO</span><span>SHOTS</span><p>Nada pendiente. Algo sospechoso pasó.</p></div>}</section>;
}

function CurrentDebt({ data, debt, onPaid }: { data: TableData; debt: DebtTransaction; onPaid: () => void }) {
  const high = debt.amount >= 30;
  return <section className="current-debt"><div className="debt-direction"><span>{playerName(data, debt.debtorPlayerId).toUpperCase()}</span><i>DEBE</i></div><strong>{debt.amount}</strong><b>SHOTS</b><div className="debt-to">A {playerName(data, debt.creditorPlayerId).toUpperCase()} <span>→</span></div><p>{high ? "Esto ya dejó de ser simbólico." : "Deuda oficialmente reconocida por la mesa."}</p><button className="paid-action" onClick={onPaid}><Check/> Marcar como pagado</button></section>;
}

function LedgerRow({ data, debt }: { data: TableData; debt: DebtTransaction }) {
  const betEvents = data.betEvents.filter((event) => event.betId === debt.betId); const lastRaise = [...betEvents].reverse().find((event) => event.multiplier); const reason = lastRaise?.type === "DOUBLE_OR_NOTHING" ? "Doble o nada" : lastRaise?.type === "TRIPLE_OR_NOTHING" ? "Triple o nada" : lastRaise ? `Apuesta x${lastRaise.multiplier}` : "Apuesta cerrada";
  return <article className={debt.status === "PAID" ? "ledger-row paid" : "ledger-row"}><time>{dateShort.format(new Date(debt.createdAt)).toUpperCase()}</time><div><b>{playerName(data, debt.debtorPlayerId)} <span>→</span> {playerName(data, debt.creditorPlayerId)}</b><small>{debt.status === "PAID" ? "Pagado" : reason}</small></div><strong>{debt.status === "PAID" ? "−" : "+"}{debt.amount}</strong></article>;
}

function NumbersView({ stats }: { stats: Stats }) {
  const repeated = stats.doubles + stats.triples >= 2;
  return <section className="numbers-view"><SectionHeading eyebrow="LOS NÚMEROS" title={<>ESTADÍSTICAS<br/>INNECESARIAMENTE<br/>SERIAS.</>} /><ScoreBoard left={stats.juanseWins} right={stats.tommyWins} leftLabel={stats.juanseName} rightLabel={stats.tommyName} label="CARA A CARA · HISTÓRICO"/><WinRateCups stats={stats}/><RecentForm stats={stats}/>{stats.betProgression.length > 0 && <div className="progression-stat"><span>MAYOR ESCALADA REGISTRADA</span><div>{stats.betProgression.map((amount, index) => <span key={`${amount}-${index}`}><b>{amount}</b>{index < stats.betProgression.length - 1 && <i>→</i>}</span>)}</div><p>SHOTS. Las matemáticas dicen una cosa. El ego dice otra.</p></div>}<BadDecisions stats={stats}/>{repeated && <p className="numbers-aside">Nadie aprendió nada.</p>}<dl className="stat-ledger"><div><dt>Partidas totales</dt><dd>{stats.totalGames}</dd></div><div><dt>Racha máxima</dt><dd>{stats.juanseName} {stats.juanseMaxStreak} <i>/</i> {stats.tommyName} {stats.tommyMaxStreak}</dd></div><div><dt>Noches ganadas</dt><dd>{stats.juanseNights} <i>—</i> {stats.tommyNights}</dd></div><div className="loud"><dt>Mayor deuda</dt><dd>{stats.maxDebt} <small>SHOTS</small></dd></div><div><dt>Dobles o nada</dt><dd>{stats.doubles}</dd></div><div><dt>Triples o nada</dt><dd>{stats.triples}</dd></div><div><dt>Shots pagados</dt><dd>{stats.shotsPaid}</dd></div></dl></section>;
}

function WinRateCups({ stats }: { stats: Stats }) { return <section className="cup-percentages"><p>PORCENTAJE DE VICTORIAS</p><CupRate name={stats.juanseName} rate={stats.juanseRate}/><CupRate name={stats.tommyName} rate={stats.tommyRate}/></section>; }
function CupRate({ name, rate }: { name: string; rate: number }) { const active = Math.round(rate / 10); return <div className="cup-rate"><div><b>{name}</b><strong>{rate}%</strong></div><div className="ten-cups" aria-label={`${name}: ${rate} por ciento de victorias`}>{Array.from({ length: 10 }).map((_, index) => <i className={index < active ? "filled" : ""} key={index}/>)}</div></div>; }
function RecentForm({ stats }: { stats: Stats }) { return <section className="recent-form"><p>FORMA RECIENTE · ÚLTIMAS {stats.recentRivalry.length}</p>{stats.recentRivalry.length ? <><FormRow name={stats.juanseName} playerId="juanse" results={stats.recentRivalry}/><FormRow name={stats.tommyName} playerId="tommy" results={stats.recentRivalry}/></> : <span>Primero hay que jugar. Obvio.</span>}</section>; }
function FormRow({ name, playerId, results }: { name: string; playerId: PlayerId; results: PlayerId[] }) { return <div className="form-row"><b>{name}</b><div>{results.map((winner, index) => <i className={winner === playerId ? "win" : "loss"} key={index}>{winner === playerId ? "G" : "P"}</i>)}</div></div>; }

function BadDecisions({ stats }: { stats: Stats }) { return <section className="bad-decisions"><div className="decision-title">ÍNDICE DE<br/><b>MALAS DECISIONES</b></div><div className="decision-score"><strong>{stats.badIndex}</strong><span>/ 100</span></div><div className="decision-meter" aria-label={`Índice de malas decisiones: ${stats.badIndex} de 100`}><i style={{ "--meter": `${stats.badIndex}%` } as CSSProperties}/></div><p>{stats.badCopy.toUpperCase()}</p><small>8 puntos por multiplicador + 1 por cada shot añadido. Sin IA. Sin excusas.</small></section>; }

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: ReactNode }) { return <header className="section-heading"><p>{eyebrow}</p><h2>{title}</h2><CupDivider/></header>; }
function CupRack({ size = "small", count = 10 }: { size?: "small" | "hero" | "stake"; count?: number }) {
  let remaining = Math.max(0, count);
  const rows: number[] = [];
  for (let rowSize = 1; remaining > 0; rowSize += 1) {
    const cupsInRow = Math.min(rowSize, remaining);
    rows.push(cupsInRow);
    remaining -= cupsInRow;
  }
  return <div className={`cup-rack cup-rack-${size}`} aria-hidden="true">{rows.map((cupsInRow, rowIndex) => <span className="cup-row" key={rowIndex}>{Array.from({ length: cupsInRow }, (_, cupIndex) => <i key={cupIndex}/>)}</span>)}</div>;
}
function CupDivider() { return <div className="cup-divider" aria-hidden="true"><i/><i/><i/><span/></div>; }
function LoadingTable() { return <main className="loading-table"><CupRack size="hero"/><span>ABRIENDO EL LIBRO DE LA MESA</span><div><i/><i/><i/></div></main>; }

function Sheet({ children, onClose, className = "" }: { children: ReactNode; onClose: () => void; className?: string }) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const dialog = dialogRef.current;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      dialog?.querySelector<HTMLElement>(".winner-zones button, input:not([disabled]), button:not(.close):not([disabled])")?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])")];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, []);

  return <div className="sheet-backdrop"><section ref={dialogRef} className={`sheet ${className}`} role="dialog" aria-modal="true" aria-label="Acción de la mesa"><div className="sheet-handle"/><button className="close" onClick={onClose} aria-label="Cerrar"><X/></button>{children}</section></div>;
}

function NightSheet({ initialNames, onClose, onCreate }: { initialNames: { a: string; b: string }; onClose: () => void; onCreate: (venue: string, amount: number, setup: NightSetup) => void }) {
  const [step, setStep] = useState<1 | 2>(1); const [venue, setVenue] = useState("Shot Me"); const [amount, setAmount] = useState("10"); const [mode, setMode] = useState<"1v1" | "2v2">("1v1"); const [names, setNames] = useState({ a1: initialNames.a, a2: "", b1: initialNames.b, b2: "" }); const setName = (key: keyof typeof names, name: string) => setNames((current) => ({ ...current, [key]: name })); const setup: NightSetup = { mode, teamA: [{ id: "juanse", name: names.a1 }, ...(mode === "2v2" ? [{ id: "team-a-2", name: names.a2 }] : [])], teamB: [{ id: "tommy", name: names.b1 }, ...(mode === "2v2" ? [{ id: "team-b-2", name: names.b2 }] : [])] }; const rosterReady = setup.teamA.every((player) => player.name.trim()) && setup.teamB.every((player) => player.name.trim()); const ready = rosterReady && Number(amount) > 0;
  return <Sheet onClose={onClose} className="night-sheet"><div className="flow-progress"><span className="active"/><span className={step === 2 ? "active" : ""}/><small>PASO {step} DE 2</small></div>{step === 1 ? <><p className="kicker">NUEVA NOCHE</p><h2>ARMA<br/>LA MESA.</h2><div className="mode-picker" role="group" aria-label="Formato de juego"><button className={mode === "1v1" ? "selected" : ""} onClick={() => setMode("1v1")}>1 CONTRA 1<small>El clásico</small></button><button className={mode === "2v2" ? "selected" : ""} onClick={() => setMode("2v2")}>2 CONTRA 2<small>Cuatro culpables</small></button></div><div className="lineup"><fieldset><legend>LADO A</legend><label>Jugador 1<input value={names.a1} onChange={(event) => setName("a1", event.target.value)} autoFocus/></label>{mode === "2v2" && <label>Jugador 2<input value={names.a2} onChange={(event) => setName("a2", event.target.value)} placeholder="Nombre"/></label>}</fieldset><span className="lineup-vs">VS</span><fieldset><legend>LADO B</legend><label>Jugador 1<input value={names.b1} onChange={(event) => setName("b1", event.target.value)}/></label>{mode === "2v2" && <label>Jugador 2<input value={names.b2} onChange={(event) => setName("b2", event.target.value)} placeholder="Nombre"/></label>}</fieldset></div><button className="primary mechanical full" disabled={!rosterReady} onClick={() => setStep(2)}>Siguiente: la apuesta <ChevronRight/></button></> : <><p className="kicker">NUEVA NOCHE</p><h2>¿QUÉ ESTÁ<br/>EN JUEGO?</h2><div className="night-review"><span>{mode === "2v2" ? "2 CONTRA 2" : "1 CONTRA 1"}</span><b>{setup.teamA.map((player) => player.name).join(" + ")} <i>VS</i> {setup.teamB.map((player) => player.name).join(" + ")}</b></div><label>Lugar<input value={venue} onChange={(event) => setVenue(event.target.value)}/></label><label>Shots en juego<input inputMode="numeric" type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)}/></label><div className="initial-stake"><span>APUESTA INICIAL</span><strong>{Number(amount) || 0}</strong><b>SHOTS</b></div><p className="hint">Quien pierda la partida decisiva queda con la deuda. La mesa guardará cada giro.</p><button className="primary mechanical full" disabled={!ready} onClick={() => onCreate(venue, Number(amount), setup)}>Poner la mesa <ChevronRight/></button><button className="text-action full" onClick={() => setStep(1)}>← Cambiar jugadores</button></>}</Sheet>;
}

function WinnerSheet({ sides, settlesBet, onClose, onWinner }: { sides: Sides; settlesBet: boolean; onClose: () => void; onWinner: (winner: string, loser: string) => void }) {
  const [selected, setSelected] = useState<"a" | "b" | null>(null); const choose = (side: "a" | "b") => { if (selected) return; setSelected(side); window.setTimeout(() => onWinner(sides[side].id, sides[side === "a" ? "b" : "a"].id), 180); };
  return <Sheet onClose={onClose} className="winner-sheet"><p className="kicker">{settlesBet ? "PARTIDA DECISIVA · CIERRA LA APUESTA" : "REGISTRAR PARTIDA · SOLO MARCADOR"}</p><h2>¿QUIÉN<br/>GANÓ?</h2><div className="winner-zones"><button className={selected === "a" ? "selected" : ""} onClick={() => choose("a")}><span>LADO A</span><b>{sides.a.label}</b>{selected === "a" && <i>GANÓ</i>}</button><em>VS</em><button className={selected === "b" ? "selected" : ""} onClick={() => choose("b")}><span>LADO B</span><b>{sides.b.label}</b>{selected === "b" && <i>GANÓ</i>}</button></div><p className="winner-hint">{settlesBet ? "El perdedor quedará con la deuda activa." : "Un toque. El marcador hace el resto."}</p></Sheet>;
}

function RaiseSheet({ active, onClose, onRaise }: { active?: Bet; onClose: () => void; onRaise: (multiplier: number) => void }) {
  const [custom, setCustom] = useState("1.5"); if (!active) return null;
  return <Sheet onClose={onClose} className="raise-sheet"><p className="kicker">SUBIR LA APUESTA</p><h2>¿CUÁNTO<br/>CRITERIO QUEDA?</h2><div className="raise-options"><button onClick={() => onRaise(2)}><span>DOBLE O NADA</span><div><b>{active.currentAmount}</b><i>→</i><strong>{active.currentAmount * 2}</strong></div><small>Nos hacemos responsables</small></button><button onClick={() => onRaise(3)}><span>TRIPLE O NADA</span><div><b>{active.currentAmount}</b><i>→</i><strong>{active.currentAmount * 3}</strong></div><small>Esto escala rápido</small></button></div><label>Multiplicador personalizado<input inputMode="decimal" value={custom} onChange={(event) => setCustom(event.target.value)}/></label><button className="outline-action full" onClick={() => onRaise(Number(custom))}>Aplicar x{custom}</button><button className="text-action full" onClick={onClose}>Todavía tenemos criterio</button></Sheet>;
}

function CloseSheet({ active, onClose, onConfirm }: { active?: Bet; onClose: () => void; onConfirm: () => void }) { if (!active) return null; return <Sheet onClose={onClose} className="close-sheet"><p className="kicker">CERRAR APUESTA</p><div className="closing-stake"><strong>{active.currentAmount}</strong><span>SHOTS</span></div><h2>UNA PARTIDA.<br/>UNA DEUDA.</h2><p className="hint">Elige al ganador de la decisiva. Quien pierda deberá {active.currentAmount} shots.</p><button className="primary mechanical full" onClick={onConfirm}><CircleDollarSign/> Registrar resultado final</button></Sheet>; }

function NavItem({ label, active, onClick, icon }: { label: string; active: boolean; onClick: () => void; icon: ReactNode }) { return <button className={active ? "active" : ""} aria-current={active ? "page" : undefined} onClick={onClick}><span className="nav-icon">{icon}</span><span>{label}</span></button>; }
function playerName(data: TableData, id: string) { return data.players.find((player) => player.id === id)?.name ?? id; }
function sidesFor(data: TableData, session: Session): Sides { const a = session.teamAPlayerIds?.length ? session.teamAPlayerIds : ["juanse"]; const b = session.teamBPlayerIds?.length ? session.teamBPlayerIds : ["tommy"]; return { a: { id: a[0], memberIds: a, label: a.map((id) => playerName(data, id)).join(" + ") }, b: { id: b[0], memberIds: b, label: b.map((id) => playerName(data, id)).join(" + ") } }; }
function sideFor(id: string, sides: Sides): "a" | "b" { return sides.a.memberIds.includes(id) ? "a" : "b"; }
function scoreOf(games: Game[], sides: Sides) { return { a: games.filter((game) => sideFor(game.winnerId, sides) === "a").length, b: games.filter((game) => sideFor(game.winnerId, sides) === "b").length }; }
function eventLabel(type: string) { if (type === "INITIAL") return "Apuesta inicial"; if (type === "SETTLED") return "Deuda cerrada"; if (type === "DOUBLE_OR_NOTHING") return "Doble o nada"; if (type === "TRIPLE_OR_NOTHING") return "Triple o nada"; return "Apuesta ajustada"; }
function tableMicrocopy(score: { a: number; b: number }, streak: ReturnType<typeof currentStreak>, streakName: string) { if (score.a === score.b) return "La mesa exige desempate."; if (streak && streak.count >= 3) return streakName.toLowerCase().includes("tommy") ? "Tommy está hablando demasiado." : `${streakName} está peligrosamente confiado.`; if (Math.abs(score.a - score.b) === 1) return "Técnicamente cuenta como ventaja."; return "La mesa lleva la cuenta."; }
function rivalryMicrocopy(stats: Stats) { if (stats.juanseWins === stats.tommyWins) return "La mesa exige desempate."; if (Math.abs(stats.juanseWins - stats.tommyWins) === 1) return "Técnicamente cuenta como ventaja."; return stats.leader ? `${stats.leader.name} lidera por ${stats.leader.margin}.` : "Ni la mesa puede separar esto."; }
