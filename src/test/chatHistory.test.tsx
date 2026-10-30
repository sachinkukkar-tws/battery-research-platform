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
    await user.click(within(previousChats()).getByRole("button", { name: "Delete the chat “Short-lived question”" }));
    expect(within(previousChats()).getByText("Your chats appear here.")).toBeInTheDocument();
    expect(screen.queryByText("Short-lived answer.")).toBeNull();
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
