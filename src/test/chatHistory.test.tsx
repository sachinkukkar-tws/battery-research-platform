import { screen, waitFor, within } from "@testing-library/react";
import { renderApp } from "./renderApp";

const answer = (text: string, conversationId: string) => ({ text, citations: [], origin: "amplifi" as const, conversationId });
const previousChats = () => screen.getByRole("navigation", { name: "Previous chats" });

describe("Previous chats", () => {
  it("keeps a chat when a new one starts, and opens it again", async () => {
    const ask = vi.fn().mockResolvedValue(answer("First answer [CP01].", "conv-1"));
    const { user } = renderApp("/ask", { amplifi: { ask } });
    expect(within(await screen.findByRole("navigation", { name: "Previous chats" })).getByText("Your chats appear here.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Message Amplifi"), "First question{Enter}");
    await screen.findByText(/^First answer/);

    await user.click(screen.getByRole("button", { name: "New chat" }));
    expect(screen.queryByText(/^First answer/)).toBeNull();
    expect(screen.getByRole("heading", { name: "What would you like to know?" })).toBeInTheDocument();

    const kept = within(previousChats()).getByRole("button", { name: /^First question/ });
    expect(kept).toHaveTextContent(/Today, \d\d:\d\d/);
    await user.click(kept);
    expect(await screen.findByText(/^First answer/)).toBeInTheDocument();
    expect(within(previousChats()).getByRole("button", { name: /^First question/ })).toHaveAttribute("aria-current", "page");
  });

  it("continues an opened chat in its own Amplifi conversation", async () => {
    const ask = vi
      .fn()
      .mockResolvedValueOnce(answer("Answer one.", "conv-1"))
      .mockResolvedValueOnce(answer("Answer two.", "conv-2"))
      .mockResolvedValueOnce(answer("Answer three.", "conv-1"));
    const { user } = renderApp("/ask", { amplifi: { ask } });
    const box = await screen.findByLabelText("Message Amplifi");
    await user.type(box, "Question one{Enter}");
    await screen.findByText("Answer one.");
    await user.click(screen.getByRole("button", { name: "New chat" }));
    await user.type(box, "Question two{Enter}");
    await screen.findByText("Answer two.");
    expect(ask.mock.calls[1]![0]).toMatchObject({ conversationId: null, history: [] });

    await user.click(within(previousChats()).getByRole("button", { name: /^Question one/ }));
    await user.type(box, "Follow-up{Enter}");
    await waitFor(() => expect(ask).toHaveBeenCalledTimes(3));
    expect(ask.mock.calls[2]![0]).toMatchObject({
      question: "Follow-up",
      conversationId: "conv-1",
      history: [
        { role: "user", text: "Question one" },
        { role: "assistant", text: "Answer one." },
      ],
    });
    // The chat asked in most recently is at the top.
    expect(
      within(previousChats())
        .getAllByRole("button", { name: /^Question/ })
        .map((b) => b.querySelector("span")?.textContent),
    ).toEqual(["Question one", "Question two"]);
  });

  it("keeps the chats after the page is closed and opened again", async () => {
    const ask = vi.fn().mockResolvedValue(answer("Kept answer.", "conv-9"));
    const first = renderApp("/ask", { amplifi: { ask } });
    await first.user.type(await screen.findByLabelText("Message Amplifi"), "Kept question{Enter}");
    await screen.findByText("Kept answer.");
    first.unmount();

    renderApp("/ask");
    expect(within(await screen.findByRole("navigation", { name: "Previous chats" })).getByRole("button", { name: /^Kept question/ })).toBeInTheDocument();
    expect(screen.getByText("Kept answer.")).toBeInTheDocument();
  });

  it("deletes a chat from the list", async () => {
    const ask = vi.fn().mockResolvedValue(answer("Short-lived answer.", "conv-3"));
    const { user } = renderApp("/ask", { amplifi: { ask } });
    await user.type(await screen.findByLabelText("Message Amplifi"), "Short-lived question{Enter}");
    await screen.findByText("Short-lived answer.");
    await user.click(within(previousChats()).getByRole("button", { name: "Options for the chat “Short-lived question”" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(within(previousChats()).getByText("Your chats appear here.")).toBeInTheDocument();
    expect(screen.queryByText("Short-lived answer.")).toBeNull();
  });

  it("renames a chat from its menu, and keeps the old name on Escape", async () => {
    const ask = vi.fn().mockResolvedValue(answer("An answer.", "conv-5"));
    const { user } = renderApp("/ask", { amplifi: { ask } });
    await user.type(await screen.findByLabelText("Message Amplifi"), "Original question{Enter}");
    await screen.findByText("An answer.");

    const menuFor = (name: string) => within(previousChats()).getByRole("button", { name: `Options for the chat “${name}”` });
    await user.click(menuFor("Original question"));
    expect(screen.getByRole("menuitem", { name: "Rename" })).toHaveFocus();
    await user.keyboard("{Enter}");
    const field = within(previousChats()).getByRole("textbox", { name: "Chat name" });
    await user.clear(field);
    await user.type(field, "ICE by electrolyte{Enter}");
    expect(within(previousChats()).getByRole("button", { name: /^ICE by electrolyte/ })).toBeInTheDocument();

    await user.click(menuFor("ICE by electrolyte"));
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));
    await user.type(within(previousChats()).getByRole("textbox", { name: "Chat name" }), " changed{Escape}");
    expect(within(previousChats()).getByRole("button", { name: /^ICE by electrolyte/ })).toBeInTheDocument();
    // Escape inside the field doesn't close the chat list.
    expect(screen.getByRole("button", { name: "Chats" })).toHaveAttribute("aria-expanded", "false");
  });

  it("pins a chat to the top, and archives one out of the list", async () => {
    const ask = vi.fn().mockResolvedValueOnce(answer("Answer A.", "conv-a")).mockResolvedValueOnce(answer("Answer B.", "conv-b"));
    const { user } = renderApp("/ask", { amplifi: { ask } });
    const box = await screen.findByLabelText("Message Amplifi");
    await user.type(box, "Question A{Enter}");
    await screen.findByText("Answer A.");
    await user.click(screen.getByRole("button", { name: "New chat" }));
    await user.type(box, "Question B{Enter}");
    await screen.findByText("Answer B.");

    const menuFor = (name: string) => within(previousChats()).getByRole("button", { name: `Options for the chat “${name}”` });
    await user.click(menuFor("Question A"));
    await user.click(screen.getByRole("menuitem", { name: "Pin" }));
    const pinned = within(previousChats()).getByRole("list", { name: "Pinned chats" });
    expect(within(pinned).getByRole("button", { name: /^Question A/ })).toBeInTheDocument();

    // Archiving the chat on screen moves it under Archived and leaves a new chat.
    await user.click(menuFor("Question B"));
    await user.click(screen.getByRole("menuitem", { name: "Archive" }));
    expect(screen.queryByText("Answer B.")).toBeNull();
    const toggle = within(previousChats()).getByRole("button", { name: "Archived (1)" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    const archived = within(previousChats()).getByRole("list", { name: "Archived chats" });
    await user.click(within(archived).getByRole("button", { name: "Options for the chat “Question B”" }));
    expect(screen.queryByRole("menuitem", { name: "Pin" })).toBeNull();
    await user.click(screen.getByRole("menuitem", { name: "Unarchive" }));
    expect(within(previousChats()).queryByRole("button", { name: /^Archived/ })).toBeNull();

    // The pins and archives are kept with the chats.
    const saved = JSON.parse(localStorage.getItem("brp-chats") ?? "{}") as { chats: { title: string; pinned?: boolean; archived?: boolean }[] };
    expect(saved.chats.find((c) => c.title === "Question A")).toMatchObject({ pinned: true });
    expect(saved.chats.find((c) => c.title === "Question B")).toMatchObject({ archived: false });
  });

  it("closes a chat's menu with Escape and returns focus to its button", async () => {
    const ask = vi.fn().mockResolvedValue(answer("An answer.", "conv-6"));
    const { user } = renderApp("/ask", { amplifi: { ask } });
    await user.type(await screen.findByLabelText("Message Amplifi"), "Menu question{Enter}");
    await screen.findByText("An answer.");
    const button = within(previousChats()).getByRole("button", { name: "Options for the chat “Menu question”" });
    await user.click(button);
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Pin" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(button).toHaveFocus();
  });

  it("exports the chat on screen as a Markdown file", async () => {
    const ask = vi.fn().mockResolvedValue(answer("Ether-based, 92.2% [CP10].", "conv-4"));
    const { user } = renderApp("/ask", { amplifi: { ask } });
    const exportButton = await screen.findByRole("button", { name: "Export chat" });
    expect(exportButton).toBeDisabled();
    await user.type(screen.getByLabelText("Message Amplifi"), "Which electrolyte gave the higher ICE?{Enter}");
    await screen.findByText(/^Ether-based/);

    let blob: Blob | undefined;
    const createObjectURL = vi.fn((b: Blob) => {
      blob = b;
      return "blob:chat";
    });
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await user.click(exportButton);

    expect(click).toHaveBeenCalledTimes(1);
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toMatch(/^amplifi-chat-\d{4}-\d\d-\d\d-which-electrolyte-gave-the-higher\.md$/);
    // jsdom's Blob has no text(), so read it the older way.
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob!);
    });
    expect(text).toContain("## Question 1\n\nWhich electrolyte gave the higher ICE?");
    expect(text).toContain("Ether-based, 92.2% [CP10].");
    expect(text).toContain("## Papers cited\n\n- **CP10**");
    expect(await screen.findByText("Chat exported as a Markdown file.")).toBeInTheDocument();
    click.mockRestore();
  });

  it("opens the list from the Chats button on a small screen, and closes it with Escape", async () => {
    const { user } = renderApp("/ask");
    const toggle = await screen.findByRole("button", { name: "Chats" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    within(previousChats()).getByRole("button", { name: "Close the chat list" }).focus();
    await user.keyboard("{Escape}");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    await user.click(within(previousChats()).getByRole("button", { name: "Close the chat list" }));
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});
