import { create } from 'zustand';

const useStore = create((set, get) => ({
  // Identity
  myId: null,
  username: '',

  // All users in the cosmos (including self)
  users: {}, // { [socketId]: { username, x, y } }

  // Proximity chat state
  nearbyUsers: {}, // { [socketId]: { username, roomId } }
  activeRooms: {}, // { [roomId]: [{ from, username, text, timestamp }] }
  openRoomId: null, // which chat room is currently open

  // Actions
  setMyId: (myId) => set({ myId }),
  setUsername: (username) => set({ username }),

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
    return { users, nearbyUsers };
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

  addProximityConnect: (userId, username, roomId) => set((state) => ({
    nearbyUsers: { ...state.nearbyUsers, [userId]: { username, roomId } },
    activeRooms: { ...state.activeRooms, [roomId]: state.activeRooms[roomId] || [] },
    openRoomId: roomId,
  })),

  removeProximityConnect: (userId) => set((state) => {
    const nearbyUsers = { ...state.nearbyUsers };
    const removedRoom = nearbyUsers[userId]?.roomId;
    delete nearbyUsers[userId];

    // Close room if no nearby users remain in it
    const stillOpen = Object.values(nearbyUsers).some(u => u.roomId === removedRoom);
    return {
      nearbyUsers,
      openRoomId: stillOpen ? state.openRoomId : null,
    };
  }),

  addMessage: (roomId, msg) => set((state) => ({
    activeRooms: {
      ...state.activeRooms,
      [roomId]: [...(state.activeRooms[roomId] || []), msg],
    },
  })),

  setOpenRoom: (roomId) => set({ openRoomId: roomId }),
}));

export default useStore;
