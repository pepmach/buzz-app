// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { Navigation } from "../navigation/controller";
import type { OpenTarget } from "../navigation/targets";
import type {
  RegisteredSidebarSection,
  SidebarSectionRow,
  SidebarSections,
} from "./sidebar-sections-service";
import { SidebarContributionSection } from "./SidebarContributionSection";
import { ChannelSidebarDnd } from "./ChannelSidebarDnd";

const target: OpenTarget = { version: 1, kind: "home" };
const row = {
  id: "item",
  label: "Useful item",
  badge: "New",
  count: 2,
  status: "Active",
};

function ThrowingIcon(): never {
  throw new Error("fixture icon failed");
}

function makeEntry(
  id: string,
  rows: RegisteredSidebarSection["rows"],
): RegisteredSidebarSection {
  return {
    version: 1,
    id,
    title: id === "good" ? "Good section" : "Broken section",
    icon: "★",
    rows,
    select: () => target,
    key: `fixture/${id}`,
    pluginId: "fixture",
    revision: "one",
  };
}

afterEach(cleanup);

it("isolates a contribution render failure and keeps sibling section actions usable", async () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const broken = {
    ...makeEntry("broken", {
      snapshot: () => [row],
      subscribe: () => () => {},
    }),
    icon: <ThrowingIcon />,
  };
  const action = vi.fn().mockRejectedValue(new Error("fixture action failed"));
  let goodRows: readonly SidebarSectionRow[] = [row];
  const rowListeners = new Set<() => void>();
  const good: RegisteredSidebarSection = {
    ...makeEntry("good", {
      snapshot: () => goodRows,
      subscribe(listener) {
        rowListeners.add(listener);
        return () => rowListeners.delete(listener);
      },
    }),
    actions: [
      {
        id: "new",
        label: "Create item",
        icon: <span aria-hidden="true">+</span>,
        onSelect: action,
      },
    ],
  };
  const registry: SidebarSections = {
    version: 1,
    snapshot: () => [broken, good],
    subscribe: () => () => {},
    register: () => {},
  };
  const open = vi.fn().mockResolvedValue({ status: "opened" });
  const navigator = { open } as unknown as Navigation;

  render(
    <ChannelSidebarDnd
      writable={false}
      onMove={() => {}}
      onReorder={() => {}}
      overlay={() => null}
    >
      {[broken, good].map((entry, index) => (
        <SidebarContributionSection
          key={entry.key}
          entry={entry}
          registry={registry}
          navigator={navigator}
          target={target}
          open
          onToggle={() => {}}
          groupIndex={index}
          reorderable={false}
          move={{}}
        />
      ))}
    </ChannelSidebarDnd>,
  );

  expect(screen.getByText(/Broken section is unavailable/)).toHaveTextContent(
    "Other sidebar sections remain available.",
  );
  const rowButton = screen.getByRole("button", { name: /Useful item/ });
  const user = userEvent.setup();
  await user.click(rowButton);
  expect(open).toHaveBeenCalledWith(target);
  expect(screen.getByText("New · 2 · Active")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Create item" }));
  expect(action).toHaveBeenCalledOnce();
  expect(
    await screen.findByText("This sidebar action couldn’t finish."),
  ).toBeInTheDocument();
  act(() => {
    goodRows = [row, { id: "later", label: "Later item" }];
    for (const listener of rowListeners) listener();
  });
  expect(screen.getByRole("button", { name: "Later item" })).toBeTruthy();
  expect(consoleError).toHaveBeenCalled();
});
