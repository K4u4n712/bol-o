import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { Availability } from '../services/nailStudio';

const monthLabel = new Intl.DateTimeFormat('pt-BR', {month:'long', year:'numeric', timeZone:'UTC'});
const dayLabel = new Intl.DateTimeFormat('pt-BR', {dateStyle:'full', timeZone:'UTC'});

type Props = {
  month: string; calendar: Availability; selected: string; disabled: boolean;
  onMonth: (month: string) => void; onDay: (day: string) => void;
};

export default function NailMonthDeck({month, calendar, selected, disabled, onMonth, onDay}: Props) {
  const deck = useRef<HTMLDivElement>(null);
  const pointer = useRef<{id:number; x:number; y:number; dx:number} | null>(null);
  const dragged = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [offset, setOffset] = useState(0);
  const [settling, setSettling] = useState(false);
  useEffect(() => () => clearTimeout(timer.current), []);

  function adjacent(direction: number) {
    const start = new Date(month + '-01T12:00:00Z');
    start.setUTCMonth(start.getUTCMonth() + direction);
    const value = start.toISOString().slice(0,7);
    return value >= calendar.first.slice(0,7) && value <= calendar.last.slice(0,7) ? value : '';
  }

  function settle(direction: number) {
    if (timer.current !== undefined || disabled) return;
    const target = direction ? adjacent(direction) : '';
    const width = deck.current?.clientWidth || 1;
    setSettling(true);
    setOffset(target ? -direction * width * 1.25 : 0);
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 250;
    timer.current = setTimeout(() => {
      if (target) onMonth(target);
      setSettling(false);
      setOffset(0);
      timer.current = undefined;
    }, duration);
  }

  function track(event: PointerEvent<HTMLDivElement>) {
    const p = pointer.current;
    if (!p || p.id !== event.pointerId) return;
    const dx = event.clientX - p.x;
    if (!dragged.current) {
      const dy = Math.abs(event.clientY - p.y);
      if (dy > 8 && dy >= Math.abs(dx)) { pointer.current = null; return; }
      if (Math.abs(dx) < 8) return;
      dragged.current = true;
      event.currentTarget.setPointerCapture(p.id);
    }
    p.dx = dx;
    setOffset(adjacent(dx < 0 ? 1 : -1) ? dx : dx * .18);
  }

  function finish(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    const p = pointer.current;
    if (!p || p.id !== event.pointerId) return;
    pointer.current = null;
    if (!dragged.current) return;
    const enough = Math.abs(p.dx) > event.currentTarget.clientWidth * .25;
    settle(!cancelled && enough ? (p.dx < 0 ? 1 : -1) : 0);
  }

  function content(value: string, preview = false) {
    const start = new Date(value + '-01T12:00:00Z');
    const count = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth()+1, 0)).getUTCDate();
    return <>
      <div className="mt" aria-live={preview ? undefined : 'polite'}>{monthLabel.format(start)}</div>
      <div className="wk" aria-hidden="true">{Array.from('DSTQQSS', (s,i) => <span key={i}>{s}</span>)}</div>
      <div className="grid">{Array.from({length:start.getUTCDay()}, (_,i) => <span key={'space'+i}/>)}
        {Array.from({length:count}, (_,i) => {
          const key = value + '-' + String(i + 1).padStart(2,'0');
          const open = Boolean(calendar.times[key]?.length);
          return <button key={key} aria-disabled={!open || disabled || preview} tabIndex={open && !preview && !disabled ? 0 : -1}
            className={'dy' + (!open ? ' off' : '') + (key === calendar.first ? ' today' : '') + (key === selected ? ' sel' : '')}
            aria-label={dayLabel.format(new Date(key + 'T12:00:00Z'))}
            onClick={() => { if (open && !preview && !disabled && !settling) onDay(key); }}>
            {i+1}{open && <i className="dt"/>}</button>;
        })}
      </div></>;
  }

  const next = offset && adjacent(offset < 0 ? 1 : -1);
  const progress = Math.min(1, Math.abs(offset) / ((deck.current?.clientWidth || 1) * .5));
  return <div className="cal">
    <div className={'deck' + (settling ? ' settling' : '')} ref={deck}
      onPointerDown={e => {
        if (disabled || settling || !e.isPrimary || e.button !== 0) return;
        pointer.current = {id:e.pointerId,x:e.clientX,y:e.clientY,dx:0};
        dragged.current = false;
      }} onPointerMove={track} onPointerUp={e => finish(e)} onPointerCancel={e => finish(e,true)}
      onLostPointerCapture={e => { if (e.target === e.currentTarget) finish(e,true); }}
      onClickCapture={e => { if (dragged.current && e.detail !== 0) { e.preventDefault(); e.stopPropagation(); } }}>
      {next ? <div className="mcard back" aria-hidden="true" style={{opacity:.35 + progress*.65,transform:'scale(' + (.94+.06*progress) + ')'}}>{content(next,true)}</div> : null}
      <div className="mcard front" style={{transform:'translateX('+offset+'px) rotate('+ Math.max(-20,Math.min(20,offset/16)) +'deg)',opacity:settling && offset ? 0 : 1-progress*.35}}>{content(month)}</div>
    </div>
    <div className="navrow"><button className="nav" aria-label="Mês anterior" disabled={disabled || settling || !adjacent(-1)} onClick={() => settle(-1)}>‹</button>
      <span className="calhint">Deslize ou use as setas</span>
      <button className="nav" aria-label="Próximo mês" disabled={disabled || settling || !adjacent(1)} onClick={() => settle(1)}>›</button></div>
  </div>;
}
