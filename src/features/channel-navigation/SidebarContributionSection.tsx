import { useState, useSyncExternalStore } from "react";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { NavigationItem } from "../../shared/design-system/ui/NavigationItem";
import { OwnedContribution } from "../../plugins/OwnedContribution";
import styles from "../../bundled/channels/Channels.module.css";
import type { Navigation } from "../navigation/controller";
import { targetKey, type OpenTarget } from "../navigation/targets";
import type {
  RegisteredSidebarSection,
  SidebarSections,
} from "./sidebar-sections-service";
import { DroppableSidebarSection } from "./ChannelSidebarDnd";

export function SidebarContributionSection({
  entry,
  registry,
  navigator,
  target,
  open,
  onToggle,
  groupIndex,
  reorderable,
  move,
}: {
  entry: RegisteredSidebarSection;
  registry: SidebarSections;
  navigator: Navigation;
  target: OpenTarget;
  open: boolean;
  onToggle: (open: boolean) => void;
  groupIndex: number;
  reorderable: boolean;
  move: { up?: () => void; down?: () => void } | undefined;
}) {
  return (
    <OwnedContribution
      entry={entry}
      registry={registry}
      fallback={
        <DroppableSidebarSection
          disabled={false}
          reorderable={reorderable}
          groupIndex={groupIndex}
          groupDomain="contributions"
          sectionKey={`plugin:${entry.key}`}
          title={entry.title}
          open={open}
          onToggle={onToggle}
          move={move}
          hideMoreActions={!reorderable}
        >
          <p role="alert">
            {entry.title} is unavailable. Other sidebar sections remain
            available.
          </p>
        </DroppableSidebarSection>
      }
    >
      {(section, active) => (
        <SectionContents
          entry={section}
          active={active}
          navigator={navigator}
          target={target}
          open={open}
          onToggle={onToggle}
          groupIndex={groupIndex}
          reorderable={reorderable}
          move={move}
        />
      )}
    </OwnedContribution>
  );
}

function SectionContents({
  entry,
  active,
  navigator,
  target,
  open,
  onToggle,
  groupIndex,
  reorderable,
  move,
}: {
  entry: RegisteredSidebarSection;
  active: () => boolean;
  navigator: Navigation;
  target: OpenTarget;
  open: boolean;
  onToggle: (open: boolean) => void;
  groupIndex: number;
  reorderable: boolean;
  move: { up?: () => void; down?: () => void } | undefined;
}) {
  const rows = useSyncExternalStore(
    entry.rows.subscribe,
    entry.rows.snapshot,
    entry.rows.snapshot,
  );
  const [actionError, setActionError] = useState(false);
  if (!Array.isArray(rows)) throw new Error("Sidebar rows must be an array");
  const ids = new Set<string>();
  for (const row of rows) {
    if (
      !row ||
      typeof row.id !== "string" ||
      !row.id ||
      ids.has(row.id) ||
      typeof row.label !== "string" ||
      !row.label.trim()
    )
      throw new Error("Sidebar rows need unique ids and non-empty labels");
    ids.add(row.id);
  }
  const selectedKey = targetKey(target);
  const select = (destination: OpenTarget) => {
    if (!active()) return;
    setActionError(false);
    try {
      void navigator.open(destination).catch(() => setActionError(true));
    } catch {
      setActionError(true);
    }
  };
  const actions = (entry.actions ?? []).map((action) => (
    <IconButton
      key={action.id}
      size="compact"
      aria-label={action.label}
      title={action.label}
      icon={action.icon}
      onClick={() => {
        if (!active()) return;
        setActionError(false);
        try {
          void Promise.resolve(action.onSelect()).catch(() =>
            setActionError(true),
          );
        } catch {
          setActionError(true);
        }
      }}
    />
  ));
  return (
    <DroppableSidebarSection
      groupDomain="contributions"
      disabled={false}
      reorderable={reorderable}
      groupIndex={groupIndex}
      sectionKey={`plugin:${entry.key}`}
      title={entry.title}
      icon={entry.icon}
      open={open}
      onToggle={onToggle}
      move={move}
      hideMoreActions={!reorderable}
      headerActions={actions}
    >
      {rows.map((row) => {
        const trailing = [
          row.badge,
          typeof row.count === "number" && Number.isFinite(row.count)
            ? new Intl.NumberFormat().format(row.count)
            : undefined,
          row.status,
        ]
          .filter((value) => typeof value === "string" && value.trim())
          .join(" · ");
        const destination = entry.select(row);
        return (
          <div key={row.id} className={styles.contributionNavigationItem}>
            <NavigationItem
              label={row.label}
              icon={row.icon}
              trailing={
                trailing ? (
                  <span className={styles.contributionMetadata}>
                    {trailing}
                  </span>
                ) : undefined
              }
              selected={targetKey(destination) === selectedKey}
              onClick={() => select(destination)}
            />
          </div>
        );
      })}
      {actionError && <p role="alert">This sidebar action couldn’t finish.</p>}
    </DroppableSidebarSection>
  );
}
