// Small helper placeholder for the OSRM fetch mock used by the distance tests.
// Kept out of src/ so it is not bundled into the app runtime.
export const mockFetch = globalThis.jest?.fn?.() ?? (() => Promise.resolve({})) as any;

export const setupDistanceFetchMock = (
  implementation?: (...args: any[]) => any
) => {
  if (implementation) {
    mockFetch.mockImplementation?.(implementation);
  } else {
    mockFetch.mockResolvedValue?.({
      ok: true,
      status: 200,
      json: async () => ({ routes: [{ distance: 12345 }] }),
    });
  }
};
