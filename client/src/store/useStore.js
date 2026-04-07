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

  // Current room zone the local user is standing in (for screen share)
  currentZone: null,
  // Active screen share in the current zone: { sharerId, sharerName } | null
  screenShareActive: null,

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
    delete nearbyUsers[userId];
    // If no one nearby remains, clear the open room
    const openRoomId = Object.keys(nearbyUsers).length > 0 ? state.openRoomId : null;
    return { nearbyUsers, openRoomId };
  }),

  addMessage: (roomId, msg) => set((state) => ({
    activeRooms: {
      ...state.activeRooms,
      [roomId]: [...(state.activeRooms[roomId] || []), msg],
    },
  })),

  setOpenRoom: (roomId) => set({ openRoomId: roomId }),

  // Called when the cluster changes — updates all nearbyUsers to the new shared roomId
  updateGroupRoom: (roomId) => set((state) => {
    const nearbyUsers = {};
    for (const [id, user] of Object.entries(state.nearbyUsers)) {
      nearbyUsers[id] = { ...user, roomId };
    }
    const activeRooms = roomId
      ? { ...state.activeRooms, [roomId]: state.activeRooms[roomId] || [] }
      : state.activeRooms;
    return { nearbyUsers, openRoomId: roomId, activeRooms };
  }),

  setCurrentZone: (zone) => set({ currentZone: zone }),
  setScreenShareActive: (info) => set({ screenShareActive: info }),

  loadHistory: (history) => set((state) => {
    const merged = { ...state.activeRooms };
    for (const [roomId, msgs] of Object.entries(history)) {
      merged[roomId] = msgs;
    }
    return { activeRooms: merged };
  }),
}));

export default useStore;
