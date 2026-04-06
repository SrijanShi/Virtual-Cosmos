import { create } from 'zustand';

const useStore = create((set) => ({
  // Identity
  myId: null,
  username: '',

  // Session
  sessionCode: null,
  sessionName: '',
  sessionRooms: [],
  isHost: false,

  // All users in the cosmos (including self)
  users: {}, // { [socketId]: { username, x, y } }

  // User status indicators (muted, handRaised) broadcast to all
  userStatuses: {}, // { [socketId]: { muted, handRaised } }

  // Proximity chat state
  nearbyUsers: {}, // { [socketId]: { username, roomId } }
  activeRooms: {}, // { [roomId]: [{ from, username, text, timestamp }] }
  openRoomId: null,

  // Actions
  setMyId: (myId) => set({ myId }),
  setUsername: (username) => set({ username }),
  setSession: ({ sessionCode, sessionName, sessionRooms, isHost }) =>
    set({ sessionCode, sessionName, sessionRooms, isHost }),

  setUsers: (users) => {
    const map = {};
    users.forEach((u) => { map[u.socketId] = u; });
    set({ users: map });
  },

  addUser: (user) => set((state) => ({
    users: { ...state.users, [user.socketId]: user },
  })),

  removeUser: (socketId) => set((state) => {
    const users = { ...state.users };
    delete users[socketId];
    const nearbyUsers = { ...state.nearbyUsers };
    delete nearbyUsers[socketId];
    const userStatuses = { ...state.userStatuses };
    delete userStatuses[socketId];
    return { users, nearbyUsers, userStatuses };
  }),

  updateUserPosition: (socketId, x, y) => set((state) => ({
    users: {
      ...state.users,
      [socketId]: { ...state.users[socketId], x, y },
    },
  })),

  updateMyPosition: (x, y) => set((state) => ({
    users: {
      ...state.users,
      [state.myId]: { ...state.users[state.myId], x, y },
    },
  })),

  setUserStatus: (socketId, status) => set((state) => ({
    userStatuses: {
      ...state.userStatuses,
      [socketId]: { ...(state.userStatuses[socketId] || {}), ...status },
    },
  })),

  addProximityConnect: (userId, username, roomId) => set((state) => ({
    nearbyUsers: { ...state.nearbyUsers, [userId]: { username, roomId } },
    activeRooms: { ...state.activeRooms, [roomId]: state.activeRooms[roomId] || [] },
    openRoomId: roomId,
  })),

  removeProximityConnect: (userId) => set((state) => {
    const nearbyUsers = { ...state.nearbyUsers };
    const removedRoom = nearbyUsers[userId]?.roomId;
    delete nearbyUsers[userId];
    const stillOpen = Object.values(nearbyUsers).some(u => u.roomId === removedRoom);
    return { nearbyUsers, openRoomId: stillOpen ? state.openRoomId : null };
  }),

  addMessage: (roomId, msg) => set((state) => ({
    activeRooms: {
      ...state.activeRooms,
      [roomId]: [...(state.activeRooms[roomId] || []), msg],
    },
  })),

  setOpenRoom: (roomId) => set({ openRoomId: roomId }),

  loadHistory: (history) => set((state) => {
    const merged = { ...state.activeRooms };
    for (const [roomId, msgs] of Object.entries(history)) {
      merged[roomId] = msgs;
    }
    return { activeRooms: merged };
  }),
}));

export default useStore;
