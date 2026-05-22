(() => {
  if (!window.crypto || typeof window.crypto.randomUUID === "function") {
    return;
  }

  const cryptoObject = window.crypto;

  if (typeof cryptoObject.getRandomValues !== "function") {
    return;
  }

  cryptoObject.randomUUID = function randomUUID() {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (value) =>
      (
        Number(value) ^
        (cryptoObject.getRandomValues(new Uint8Array(1))[0] &
          (15 >> (Number(value) / 4)))
      ).toString(16),
    );
  };
})();
