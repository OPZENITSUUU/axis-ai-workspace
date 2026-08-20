export function createChatDataReloadActions(actions: {
  reloadConversation: () => void;
  reloadConversationList: () => void;
}) {
  return {
    retryConversation() {
      actions.reloadConversation();
    },
    retryConversationList() {
      actions.reloadConversationList();
    },
  };
}
