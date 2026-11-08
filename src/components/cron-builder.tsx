'use client';

import { useState, useMemo, useEffect } from 'react';
import { Text, Flex, Code } from '@radix-ui/themes';
import { SearchableSelect } from './searchable-select';

const FREQUENCIES = [
  { value: 'minute', label: 'Every Minute' },
  { value: '5min', label: 'Every 5 Minutes' },
  { value: '15min', label: 'Every 15 Minutes' },
  { value: '30min', label: 'Every 30 Minutes' },
  { value: 'hour', label: 'Every Hour' },
  { value: '6hour', label: 'Every 6 Hours' },
  { value: 'day', label: 'Every Day' },
  { value: 'week', label: 'Every Week' },
  { value: 'month', label: 'Every Month' },
  { value: 'custom', label: 'Custom Cron' },
];

const MINUTES = Array.from({ length: 60 }, (_, i) => ({
  value: String(i),
  label: String(i).padStart(2, '0'),
}));

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: String(i),
  label: String(i).padStart(2, '0'),
}));

const DAYS_OF_WEEK = [
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
  { value: '0', label: 'Sunday' },
];

const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

interface CronBuilderProps {
  value: string;
  onChange: (cron: string) => void;
}

export function CronBuilder({ value, onChange }: CronBuilderProps) {
  const [frequency, setFrequency] = useState('hour');
  const [minute, setMinute] = useState('0');
  const [hour, setHour] = useState('9');
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [customCron, setCustomCron] = useState('');

  // Generate cron from selections
  const generatedCron = useMemo(() => {
    switch (frequency) {
      case 'minute': return '* * * * *';
      case '5min': return '*/5 * * * *';
      case '15min': return '*/15 * * * *';
      case '30min': return '*/30 * * * *';
      case 'hour': return `${minute} * * * *`;
      case '6hour': return `${minute} */6 * * *`;
      case 'day': return `${minute} ${hour} * * *`;
      case 'week': return `${minute} ${hour} * * ${dayOfWeek}`;
      case 'month': return `${minute} ${hour} ${dayOfMonth} * *`;
      case 'custom': return customCron;
      default: return '0 * * * *';
    }
  }, [frequency, minute, hour, dayOfWeek, dayOfMonth, customCron]);

  // Emit cron on change
  useEffect(() => {
    if (generatedCron && generatedCron !== value) {
      onChange(generatedCron);
    }
  }, [generatedCron]);

  // Try to parse incoming value to set initial state
  useEffect(() => {
    if (!value) return;
    if (value === '* * * * *') { setFrequency('minute'); return; }
    if (value === '*/5 * * * *') { setFrequency('5min'); return; }
    if (value === '*/15 * * * *') { setFrequency('15min'); return; }
    if (value === '*/30 * * * *') { setFrequency('30min'); return; }

    const parts = value.split(' ');
    if (parts.length !== 5) { setFrequency('custom'); setCustomCron(value); return; }

    const [m, h, dom, , dow] = parts;

    if (h === '*' && dom === '*' && dow === '*') {
      setFrequency('hour');
      setMinute(m === '*' ? '0' : m);
    } else if (h === '*/6' && dom === '*' && dow === '*') {
      setFrequency('6hour');
      setMinute(m === '*' ? '0' : m);
    } else if (dom === '*' && dow === '*') {
      setFrequency('day');
      setMinute(m);
      setHour(h);
    } else if (dom === '*' && dow !== '*') {
      setFrequency('week');
      setMinute(m);
      setHour(h);
      setDayOfWeek(dow);
    } else if (dow === '*') {
      setFrequency('month');
      setMinute(m);
      setHour(h);
      setDayOfMonth(dom);
    } else {
      setFrequency('custom');
      setCustomCron(value);
    }
  }, []);

  return (
    <Flex align="center" gap="2" wrap="wrap">
      <SearchableSelect
        value={frequency}
        onChange={setFrequency}
        options={FREQUENCIES}
        width={150}
        placeholder="Frequency"
        searchPlaceholder="Search..."
      />

      {(frequency === 'hour' || frequency === '6hour') && (
        <>
          <Text style={{ fontSize: 12, color: 'var(--gray-8)' }}>at minute</Text>
          <SearchableSelect
            value={minute}
            onChange={setMinute}
            options={MINUTES}
            width={70}
            placeholder="00"
            searchPlaceholder="Min"
          />
        </>
      )}

      {(frequency === 'day') && (
        <>
          <Text style={{ fontSize: 12, color: 'var(--gray-8)' }}>at</Text>
          <SearchableSelect value={hour} onChange={setHour} options={HOURS} width={65} placeholder="HH" searchPlaceholder="Hour" />
          <Text style={{ fontSize: 12, color: 'var(--gray-8)' }}>:</Text>
          <SearchableSelect value={minute} onChange={setMinute} options={MINUTES} width={65} placeholder="MM" searchPlaceholder="Min" />
        </>
      )}

      {frequency === 'week' && (
        <>
          <Text style={{ fontSize: 12, color: 'var(--gray-8)' }}>on</Text>
          <SearchableSelect value={dayOfWeek} onChange={setDayOfWeek} options={DAYS_OF_WEEK} width={110} placeholder="Day" searchPlaceholder="Day" />
          <Text style={{ fontSize: 12, color: 'var(--gray-8)' }}>at</Text>
          <SearchableSelect value={hour} onChange={setHour} options={HOURS} width={65} placeholder="HH" searchPlaceholder="Hour" />
          <Text style={{ fontSize: 12, color: 'var(--gray-8)' }}>:</Text>
          <SearchableSelect value={minute} onChange={setMinute} options={MINUTES} width={65} placeholder="MM" searchPlaceholder="Min" />
        </>
      )}

      {frequency === 'month' && (
        <>
          <Text style={{ fontSize: 12, color: 'var(--gray-8)' }}>on day</Text>
          <SearchableSelect value={dayOfMonth} onChange={setDayOfMonth} options={DAYS_OF_MONTH} width={65} placeholder="1" searchPlaceholder="Day" />
          <Text style={{ fontSize: 12, color: 'var(--gray-8)' }}>at</Text>
          <SearchableSelect value={hour} onChange={setHour} options={HOURS} width={65} placeholder="HH" searchPlaceholder="Hour" />
          <Text style={{ fontSize: 12, color: 'var(--gray-8)' }}>:</Text>
          <SearchableSelect value={minute} onChange={setMinute} options={MINUTES} width={65} placeholder="MM" searchPlaceholder="Min" />
        </>
      )}

      {frequency === 'custom' && (
        <input
          value={customCron}
          onChange={(e) => setCustomCron(e.target.value)}
          placeholder="* * * * *"
          style={{
            width: 160, padding: '5px 8px', fontSize: 12, fontFamily: 'monospace',
            background: 'var(--gray-3)', color: 'var(--gray-12)',
            border: 'none', boxShadow: 'inset 0 0 0 1px var(--gray-a6)',
            borderRadius: 0, outline: 'none',
          }}
        />
      )}

      {/* Cron preview */}
      <Code style={{ fontSize: 11, padding: '4px 8px', background: 'var(--gray-a2)', color: 'var(--gray-10)' }}>
        {generatedCron || '—'}
      </Code>
    </Flex>
  );
}
