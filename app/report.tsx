import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Card, Divider, Screen } from '../src/components/ui';
import { TrendChart } from '../src/components/TrendChart';
import { BodyMap } from '../src/components/BodyMap';
import { useApp } from '../src/store/AppStore';
import { getPatient } from '../src/store/backend';
import { progressReport } from '../src/llm/tasks';
import type { ProgressReport } from '../src/llm/schemas';
import { averageSeverity, severitySeries } from '../src/logic/analysis';
import type { AppData, BodyRegion } from '../src/types';
import { colors, radius, spacing, type } from '../src/theme';

const TREND_TONE: Record<ProgressReport['trend'], string> = {
  improving: colors.accent,
  steady: colors.primary,
  worsening: colors.warn,
  not_enough_data: colors.textMuted,
};

/**
 * The shareable report. GLM runs with reasoning on here — it is the one place
 * in the app where a few extra seconds buys a noticeably better write-up.
 */
export default function Report() {
  const { patient } = useLocalSearchParams<{ patient?: string }>();
  const patientId = Array.isArray(patient) ? patient[0] : patient;
  const { data: session } = useApp();
  const [other, setOther] = useState<AppData | null | undefined>(patientId ? undefined : null);
  const [report, setReport] = useState<ProgressReport | null>(null);
  const [progress, setProgress] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    getPatient(patientId).then((found) => {
      if (!cancelled) setOther(found);
    });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const data = patientId ? other : session;

  const generate = async (source: AppData) => {
    setLoading(true);
    setProgress('');
    try {
      setReport(await progressReport(source, setProgress));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!data) return;
    generate(data);
    // Each visit writes a new report. Leaving and opening it again runs this again.
  }, [patientId, data]);

  if (!data) {
    return (
      <Screen scroll={false} style={s.centre}>
        {other === null ? (
          <Text style={type.h3}>This account could not be opened.</Text>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </Screen>
    );
  }

  const severityByRegion = data.tics.reduce<Partial<Record<BodyRegion, number>>>((acc, tic) => {
    acc[tic.region] = Math.max(acc[tic.region] ?? 0, tic.severity);
    return acc;
  }, {});

  const latest = data.checkIns[data.checkIns.length - 1] ?? null;

  return (
    <Screen>
      <Card>
        <Text style={type.label}>PREPARED FOR</Text>
        <Text style={[type.h2, { marginTop: spacing(0.5) }]}>{data.profile?.displayName}</Text>
        <Text style={type.muted}>
          {data.checkIns.length} check-ins ·{' '}
          {data.checkIns[0]?.date ?? '—'} to {latest?.date ?? '—'}
        </Text>

        <Divider />

        {loading ? (
          <View style={s.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[type.muted, { flex: 1 }]}>
              {progress
                ? preview(progress)
                : patientId
                  ? 'Reading through this history…'
                  : 'Reading through your history…'}
            </Text>
          </View>
        ) : (
          <>
            <Text style={[type.small, { color: TREND_TONE[report?.trend ?? 'steady'], fontWeight: '800' }]}>
              {(report?.trend ?? 'steady').replace(/_/g, ' ').toUpperCase()}
            </Text>
            <Text style={[type.h3, { marginTop: spacing(0.75), fontSize: 19, lineHeight: 27 }]}>
              {report?.headline}
            </Text>
          </>
        )}
      </Card>

      <Card style={{ alignItems: 'center', paddingVertical: spacing(3) }}>
        <Text style={[type.label, { alignSelf: 'flex-start' }]}>AFFECTED AREAS</Text>
        <BodyMap severityByRegion={severityByRegion} size={180} />
      </Card>

      <Card>
        <Text style={type.label}>AVERAGE SEVERITY</Text>
        <View style={{ height: spacing(1) }} />
        <TrendChart series={severitySeries(data)} width={290} height={160} scoreAxis />
        {latest && (
          <Text style={[type.muted, { marginTop: spacing(1) }]}>
            Most recent daily average: {averageSeverity(latest).toFixed(1)} / 5.
          </Text>
        )}
      </Card>

      {report && !loading && (
        <>
          <Card>
            <Text style={type.label}>OBSERVATIONS</Text>
            <View style={{ height: spacing(1) }} />
            {report.observations.map((line, i) => (
              <Bullet key={i} text={line} />
            ))}
          </Card>

          {report.triggers.length > 0 && (
            <Card style={s.triggers}>
              <Text style={type.label}>CONTEXT</Text>
              <View style={{ height: spacing(1) }} />
              {report.triggers.map((line, i) => (
                <Bullet key={i} text={line} tone={colors.warn} />
              ))}
            </Card>
          )}

          <Card>
            <Text style={type.label}>NEXT STEPS</Text>
            <View style={{ height: spacing(1) }} />
            {report.nextSteps.map((line, i) => (
              <Bullet key={i} text={line} tone={colors.accent} />
            ))}
          </Card>
        </>
      )}

      <Text style={[type.small, { textAlign: 'center' }]}>
        Self-reported data from a habit-reversal app. Not a diagnosis.
      </Text>
    </Screen>
  );
}

function Bullet({ text, tone = colors.primary }: { text: string; tone?: string }) {
  return (
    <View style={s.bulletRow}>
      <View style={[s.bullet, { backgroundColor: tone }]} />
      <Text style={[type.body, { flex: 1 }]}>{text}</Text>
    </View>
  );
}

/** Show the headline as soon as it appears in the JSON stream. */
function preview(raw: string): string {
  const headline = raw.match(/"headline"\s*:\s*"([^"]*)/);
  return headline ? headline[1] : 'Reading through your history…';
}

const s = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center' },
  loading: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  bulletRow: { flexDirection: 'row', gap: spacing(1.25), marginBottom: spacing(1.25) },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  triggers: { backgroundColor: '#FDF6E9', borderColor: 'transparent', borderRadius: radius.lg },
});
