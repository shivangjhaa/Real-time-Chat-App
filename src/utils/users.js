const users = [];

const addUser = ({ id, username, room, roomName }) => {
  room = (room || "").trim().toLowerCase();
  username = (username || "").trim();
  const roomDisplayName = (roomName || room).trim();

  if (!username || !room) {
    return { error: "Username and room are required!" };
  }

  const existingUser = users.find((user) => {
    return user.room === room && user.username.toLowerCase() === username.toLowerCase();
  });

  if (existingUser) {
    return { error: "Username is already in use in this room!" };
  }

  const user = { id, username, room, roomName: roomDisplayName };
  users.push(user);
  return { user };
};

const removeUser = (id) => {
  const index = users.findIndex((user) => user.id === id);
  if (index !== -1) {
    return users.splice(index, 1)[0]; // remove and return the removed user
  }
};

const getUser = (id) => {
  return users.find((user) => user.id === id);
};

const getUsersInRoom = (room) => {
  const normalizedRoom = (room || "").trim().toLowerCase();
  return users.filter((user) => user.room === normalizedRoom);
};

module.exports = {
  addUser,
  removeUser,
  getUser,
  getUsersInRoom,
};
