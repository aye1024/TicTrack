import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Button, Card, Divider, Screen } from '../src/components/ui';
import { CountUp, FadeInUp } from '../src/components/motion';
import { CountBars } from '../src/components/CountBars';
import { useApp } from '../src/store/AppStore';
import {
  DEVICES,
  deviceById,
  hourLabel,
  isUncovered,
  linkOf,
  pairedDevices,
  peakWindow,
  projectedCount,
  wearableCorrelations,
  wearableDay,
  wearableWeek,
  type WearableDevice,
} from '../src/data/wearable';
import { colors, radius, severityColor, spacing, type } from '../src/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * The passive half of the app. A check-in is one number a day, given from
 * memory at night; the wearable fills in the hours between — how many tics,
 * when they clustered, how long each one ran.
 *
 * The readings are simulated. This screen exists to show the shape of the
 * feature end to end: pair a device, sync it, read the day back, and carry the
 * counts into the check-in instead of guessing at them.
 */
export default function Wearable() {
  const router = useRouter();
  const { data, update } = useApp();
  const devices = pairedDevices(data);
  const link = linkOf(data);
  const unpaired = DEVICES.filter((choice) => !link.deviceIds.includes(choice.id));

  const [pairing, setPairing] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const pair = (choice: WearableDevice) => {
    setPairing(choice.id);
    // A pairing handshake takes a moment; the wait is what makes it read as
    // hardware rather than a settings toggle.
    setTimeout(() => {
      update((draft) => {
        const current = linkOf(draft);
        const now = new Date().toISOString();
        draft.wearable = {
          ...current,
          deviceIds: current.deviceIds.includes(choice.id)
            ? current.deviceIds
            : [...current.deviceIds, choice.id],
          // `pairedAt` is when the first one was added, so it survives the rest.
          pairedAt: current.pairedAt ?? now,
          lastSyncAt: now,
        };
      });
      setPairing(null);
    }, 1400);
  };

  const unpair = (id: string) =>
    update((draft) => {
      const current = linkOf(draft);
      const deviceIds = current.deviceIds.filter((candidate) => candidate !== id);
      draft.wearable = deviceIds.length
        ? { ...current, deviceIds }
        : { deviceIds: [], pairedAt: null, lastSyncAt: null };
    });

  const sync = () => {
    setSyncing(true);
    setTimeout(() => {
      update((draft) => {
        draft.wearable = { ...linkOf(draft), lastSyncAt: new Date().toISOString() };
      });
      setSyncing(false);
    }, 900);
  };

  if (devices.length === 0) {
    return (
      <Screen>
        <Text style={type.h2}>Let something else do the counting</Text>
        <Text style={type.muted}>
          A daily rating is one number recalled at bedtime. A device you already wear can count the
          tics as they happen, and hand you the day when you check in.
        </Text>

        <Text style={[type.label, { marginTop: spacing(1) }]}>PAIR A DEVICE</Text>
        {DEVICES.map((choice, index) => (
          <FadeInUp key={choice.id} index={index}>
            <Card onPress={pairing ? undefined : () => pair(choice)}>
              <View style={s.rowBetween}>
                <Text style={type.h3}>{choice.name}</Text>
                {pairing === choice.id ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Ionicons name="chevron-forward" size={17} color={colors.textFaint} />
                )}
              </View>
              <View style={s.iconRow}>
                <Ionicons name={choice.icon as IconName} size={15} color={colors.textMuted} />
                <Text style={type.muted}>{choice.sensors}</Text>
              </View>
              <Text style={[type.muted, { marginTop: spacing(1) }]}>{choice.blurb}</Text>
            </Card>
          </FadeInUp>
        ))}

        <Disclaimer />
      </Screen>
    );
  }

  return (
    <PairedView
      devices={devices}
      unpaired={unpaired}
      pairing={pairing}
      lastSyncAt={link.lastSyncAt}
      syncing={syncing}
      onSync={sync}
      onPair={pair}
      onUnpair={unpair}
      onCheckIn={() => router.push('/checkin?prefill=wearable')}
    />
  );
}

function PairedView({
  devices,
  unpaired,
  pairing,
  lastSyncAt,
  syncing,
  onSync,
  onPair,
  onUnpair,
  onCheckIn,
}: {
  devices: WearableDevice[];
  unpaired: WearableDevice[];
  pairing: string | null;
  lastSyncAt: string | null;
  syncing: boolean;
  onSync: () => void;
  onPair: (choice: WearableDevice) => void;
  onUnpair: (id: string) => void;
  onCheckIn: () => void;
}) {
  const { data, todayCheckIn } = useApp();
  const [confirmUnpair, setConfirmUnpair] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const day = useMemo(() => wearableDay(data), [data]);
  const week = useMemo(() => wearableWeek(data), [data]);
  // Three weeks of readings, so this is the one thing here worth memoising.
  const links = useMemo(() => wearableCorrelations(data), [data]);
  const missed = data.tics.filter((tic) => isUncovered(devices, tic));
  const window = peakWindow(day.hours);

  const weekAverage =
    week.slice(0, -1).reduce((sum, d) => sum + d.total, 0) / Math.max(1, week.length - 1);
  // Today is only part-counted, so the comparison is made on the day's pace,
  // projected by how much of a day's weight the covered hours carry.
  const projected = projectedCount(day.total, day.coveredHours);
  const versus = weekAverage > 0 ? Math.round(((projected - weekAverage) / weekAverage) * 100) : 0;
  const versusTone = versus > 5 ? colors.warn : versus < -5 ? colors.accent : colors.textMuted;

  return (
    <Screen>
      {/* Device state, and the only control that matters: sync. */}
      <FadeInUp>
        <Card>
          <View style={s.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={type.label}>
                {devices.length === 1 ? 'PAIRED DEVICE' : `PAIRED DEVICES · ${devices.length}`}
              </Text>
            </View>
            <View style={s.tag}>
              <Text style={s.tagText}>CONNECTED</Text>
            </View>
          </View>

          {devices.map((paired, index) => (
            <View key={paired.id} style={[s.deviceRow, index > 0 && s.deviceRowBorder]}>
              <Ionicons name={paired.icon as IconName} size={19} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={type.h3}>{paired.name}</Text>
                <Text style={type.small}>{paired.sensors}</Text>
              </View>
              {/* Battery is per device, so it cannot be one number up top. */}
              <Text style={type.small}>{batteryOf(paired.id)}%</Text>
            </View>
          ))}

          <Text style={[type.muted, { marginTop: spacing(1) }]}>
            {lastSyncAt ? `All synced ${clockOf(lastSyncAt)}` : 'Not synced yet'}
          </Text>

          <Divider />
          <Button
            title={syncing ? 'Syncing…' : devices.length > 1 ? 'Sync all' : 'Sync now'}
            variant="secondary"
            loading={syncing}
            onPress={onSync}
          />
          {unpaired.length > 0 && (
            <>
              <View style={{ height: spacing(1) }} />
              <Button
                title={adding ? 'Never mind' : 'Pair another device'}
                variant="ghost"
                onPress={() => setAdding((open) => !open)}
              />
            </>
          )}
        </Card>
      </FadeInUp>

      {/* Adding a second or third device, without leaving the readout. */}
      {adding &&
        unpaired.map((choice, index) => (
          <FadeInUp key={choice.id} index={index}>
            <Card onPress={pairing ? undefined : () => onPair(choice)}>
              <View style={s.rowBetween}>
                <Text style={type.h3}>{choice.name}</Text>
                {pairing === choice.id ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Ionicons name="add" size={19} color={colors.primary} />
                )}
              </View>
              <View style={s.iconRow}>
                <Ionicons name={choice.icon as IconName} size={15} color={colors.textMuted} />
                <Text style={type.muted}>{choice.sensors}</Text>
              </View>
              <Text style={[type.muted, { marginTop: spacing(1) }]}>{choice.blurb}</Text>
            </Card>
          </FadeInUp>
        ))}

      {/* The headline: what the device counted while nobody was rating anything. */}
      <FadeInUp index={1}>
        <Card>
          <View style={s.rowBetween}>
            <View>
              <Text style={type.label}>
                {day.partial ? 'TICS COUNTED SO FAR' : 'TICS COUNTED TODAY'}
              </Text>
              <CountUp value={day.total} style={[s.big, { color: colors.primary }]} />
            </View>
            {weekAverage > 0 && day.total > 0 && (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={type.label}>VS YOUR WEEK</Text>
                <CountUp
                  value={versus}
                  prefix={versus > 0 ? '+' : ''}
                  suffix="%"
                  style={[s.big, { color: versusTone }]}
                />
              </View>
            )}
          </View>
          <Text style={[type.muted, { marginTop: spacing(1) }]}>
            {window
              ? `Heaviest between ${window}. Counted ${day.partial ? `up to ${hourLabel(day.coveredHours - 1)}` : 'over the full day'}.`
              : 'Nothing above the detection threshold yet today.'}
          </Text>
        </Card>
      </FadeInUp>

      {/* Hour by hour — the sleep gap, the school day, the evening peak. */}
      <FadeInUp index={2}>
        <Card>
          <Text style={type.label}>WHEN THEY HAPPENED</Text>
          <View style={{ height: spacing(1) }} />
          <CountBars
            values={day.hours}
            highlight={day.peakHours}
            labels={day.hours.map((_, hour) => (hour % 6 === 0 ? hourLabel(hour) : null))}
          />
          <Text style={[type.muted, { marginTop: spacing(1) }]}>
            {window
              ? `The green stretch is where they cluster, ${window} today.`
              : 'Nothing counted yet today.'}
          </Text>
        </Card>
      </FadeInUp>

      {/* Per tic: count, duration, and the rating those counts work out to. */}
      <FadeInUp index={3}>
        <Text style={[type.label, { marginTop: spacing(1) }]}>BY TIC</Text>
        {day.detections.length === 0 ? (
          <Card>
            <Text style={type.muted}>
              Nothing detected yet today. The counts appear as the day goes on.
            </Text>
          </Card>
        ) : (
          <Card style={{ paddingVertical: spacing(1) }}>
            {day.detections.map((detection, i) => (
              <View key={detection.ticId} style={[s.ticRow, i > 0 && s.ticRowBorder]}>
                <View
                  style={[
                    s.severityChip,
                    { backgroundColor: severityColor(detection.suggestedSeverity) },
                  ]}
                >
                  <Text style={s.severityChipText}>{detection.suggestedSeverity}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={type.h3}>{detection.name}</Text>
                  <Text style={type.small}>
                    {detection.count} time{detection.count === 1 ? '' : 's'} ·{' '}
                    {detection.meanSeconds}s each · peak {hourLabel(detection.peakHour)}
                  </Text>
                  {devices.length > 1 && (
                    <Text style={type.small}>
                      via {deviceById(detection.deviceId)?.name ?? 'a paired device'}
                    </Text>
                  )}
                  <View style={{ height: spacing(1) }} />
                  <CountBars
                    values={detection.hours}
                    height={28}
                    color={severityColor(Math.max(2, detection.suggestedSeverity))}
                  />
                </View>
              </View>
            ))}
            <Text style={[type.small, { marginTop: spacing(1.5), paddingHorizontal: 2 }]}>
              The number on the left is what that many tics works out to on the 0–5 scale.
            </Text>
          </Card>
        )}
      </FadeInUp>

      {/* The device cannot see everything — say so rather than quietly dropping it. */}
      {missed.length > 0 && (
        <FadeInUp index={4}>
          <Card style={s.notCovered}>
            <Text style={type.label}>NOT COVERED</Text>
            <View style={{ height: spacing(1) }} />
            {missed.map((tic) => (
              <View key={tic.id} style={s.bulletRow}>
                <View style={s.bullet} />
                <Text style={[type.body, { flex: 1 }]}>
                  {tic.name}:{' '}
                  {tic.kind === 'vocal'
                    ? 'nothing you have paired carries a microphone on you, so a vocal tic never registers. AirPods or glasses would hear it.'
                    : `that movement is too far from ${listNames(devices)} to register.`}{' '}
                  Keep rating it yourself at check-in.
                </Text>
              </View>
            ))}
          </Card>
        </FadeInUp>
      )}

      {/* Sleep and stress, the two inputs the board had feeding back into severity. */}
      {day.sleepHours != null && day.stressIndex != null && (
        <FadeInUp index={5}>
          <Card>
            <Text style={type.label}>THE REST OF THE DAY</Text>
            <View style={s.vitals}>
              <Vital label="SLEPT" value={day.sleepHours} decimals={1} suffix="h" />
              <Vital label="STRESS INDEX" value={day.stressIndex} />
              <View style={{ flex: 1 }}>
                <Text style={type.label}>QUIETEST HOUR</Text>
                <Text style={s.vitalValue}>
                  {hourLabel(quietestHour(day.hours, day.coveredHours))}
                </Text>
              </View>
            </View>
            <Text style={[type.muted, { marginTop: spacing(1.5) }]}>
              Short sleep and a high stress index are the two things that most often show up on a
              worse day. History cross-checks them against what you actually reported.
            </Text>
          </Card>
        </FadeInUp>
      )}

      {/* The case for wearing it: what it measured, against what it counted. */}
      {links.length > 0 && (
        <FadeInUp index={6}>
          <Card>
            <Text style={type.label}>WHAT LINES UP</Text>
            <Text style={[type.muted, { marginTop: spacing(1) }]}>
              Both sides of this come from the device: its own sleep and stress readings, set
              against the tics it counted.
            </Text>
            {links.map((link, index) => (
              <View key={link.label} style={[s.linkRow, index > 0 && s.deviceRowBorder]}>
                <View style={s.linkDelta}>
                  <CountUp value={link.deltaPercent} prefix="+" suffix="%" style={s.linkDeltaText} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={type.h3}>{link.label}</Text>
                  <Text style={type.small}>
                    {link.withMean} tics a day on the {link.days} day
                    {link.days === 1 ? '' : 's'} it recorded {link.condition}, against{' '}
                    {link.withoutMean} on the rest.
                  </Text>
                </View>
              </View>
            ))}
            <Text style={[type.small, { marginTop: spacing(1.5) }]}>
              History does the same thing against what you reported yourself. Where the two agree,
              the pattern is worth acting on.
            </Text>
          </Card>
        </FadeInUp>
      )}

      {/* The last week, so today has something to sit against. */}
      <FadeInUp index={7}>
        <Card>
          <Text style={type.label}>LAST 7 DAYS</Text>
          <View style={{ height: spacing(1) }} />
          <CountBars
            values={week.map((d) => d.total)}
            highlight={week.length - 1}
            labels={week.map((d) => dayLetter(d.date))}
            height={96}
          />
          <Text style={[type.muted, { marginTop: spacing(1) }]}>
            Tics counted each day, today in green.
          </Text>
        </Card>
      </FadeInUp>

      <FadeInUp index={8}>
        {todayCheckIn ? (
          <Card style={s.doneCard}>
            <Text style={[type.h3, { color: colors.accent }]}>Today's check-in is already done</Text>
            <Text style={[type.muted, { marginTop: spacing(0.5) }]}>
              Tomorrow's will open with these counts filled in.
            </Text>
          </Card>
        ) : (
          <Button title="Start check-in with these counts" onPress={onCheckIn} />
        )}
      </FadeInUp>

      {devices.map((paired) => (
        <Button
          key={paired.id}
          title={
            confirmUnpair === paired.id
              ? `Confirm, unpair ${paired.name}`
              : `Unpair ${paired.name}`
          }
          variant={confirmUnpair === paired.id ? 'danger' : 'ghost'}
          onPress={() => {
            if (confirmUnpair !== paired.id) {
              setConfirmUnpair(paired.id);
              return;
            }
            setConfirmUnpair(null);
            onUnpair(paired.id);
          }}
        />
      ))}

      <Disclaimer />
    </Screen>
  );
}

function Vital({
  label,
  value,
  decimals = 0,
  suffix = '',
}: {
  label: string;
  value: number | null;
  decimals?: number;
  suffix?: string;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={type.label}>{label}</Text>
      {value == null ? (
        <Text style={s.vitalValue}>—</Text>
      ) : (
        <CountUp value={value} decimals={decimals} suffix={suffix} style={s.vitalValue} />
      )}
    </View>
  );
}

/** Never let a demo readout pass for a measurement. */
function Disclaimer() {
  return (
    <Text style={[type.small, { textAlign: 'center' }]}>
      Prototype. No device is connected, and the readings are simulated from your own ratings.
    </Text>
  );
}

/** "your Apple Watch and AirPods" — for the sentence about what cannot see a tic. */
function listNames(devices: WearableDevice[]): string {
  const names = devices.map((d) => d.name);
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

/** Stable per device, so a re-render does not look like the battery moved. */
const batteryOf = (id: string) => 58 + (id.charCodeAt(0) % 5) * 8;

const clockOf = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

const dayLetter = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2);

/** The calmest waking hour so far — the one stretch worth asking about. */
function quietestHour(hours: number[], covered: number): number {
  let best = 7;
  for (let hour = 8; hour < Math.min(covered, 23); hour += 1) {
    if (hours[hour] < hours[best]) best = hour;
  }
  return best;
}

const s = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing(0.75) },
  big: { fontSize: 32, fontWeight: '800', marginTop: 2 },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    paddingVertical: spacing(1.25),
  },
  deviceRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    paddingTop: spacing(1.5),
    marginTop: spacing(0.5),
  },
  linkDelta: {
    minWidth: 54,
    paddingHorizontal: spacing(0.75),
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: '#FDF6E9',
    alignItems: 'center',
  },
  linkDeltaText: { fontSize: 15, fontWeight: '800', color: colors.warn },
  tag: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing(1),
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  tagText: { fontSize: 10, fontWeight: '800', color: colors.accent, letterSpacing: 0.6 },
  ticRow: { flexDirection: 'row', gap: spacing(1.5), paddingVertical: spacing(1.5) },
  ticRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  severityChip: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  severityChipText: { color: colors.white, fontWeight: '800', fontSize: 16 },
  notCovered: { backgroundColor: '#FDF6E9', borderColor: 'transparent' },
  bulletRow: { flexDirection: 'row', gap: spacing(1.25), marginBottom: spacing(1.25) },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 8, backgroundColor: colors.warn },
  doneCard: { backgroundColor: colors.accentSoft, borderColor: 'transparent' },
  vitals: { flexDirection: 'row', gap: spacing(1.5), marginTop: spacing(1.5) },
  vitalValue: { fontSize: 24, fontWeight: '800', color: colors.text, marginTop: 2 },
});
