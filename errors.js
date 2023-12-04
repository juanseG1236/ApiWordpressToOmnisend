class NoNewPostsError extends Error {
  constructor(message) {
    super(message);
    this.name = "NoNewPostsError";
  }
}

class OtherCustomError extends Error {
  constructor(message) {
    super(message);
    this.name = "OtherCustomError";
  }
}

module.exports = {
  NoNewPostsError: NoNewPostsError,
  OtherCustomError: OtherCustomError,
};
