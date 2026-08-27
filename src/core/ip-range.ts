/**
 * Whether an address is one a server must not be talked into reaching.
 *
 * This is the check that stops a user-supplied document URL from becoming a
 * request to the cloud metadata endpoint, a database on a private subnet, or a
 * service listening on loopback. Anything unparseable counts as private:
 * guessing in the other direction favours whoever supplied the address.
 */

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

const isPrivateV4 = (a: number, b: number, _c: number, _d: number): boolean =>
  a === 0 || // unspecified
  a === 10 || // RFC 1918
  a === 127 || // loopback
  (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
  (a === 169 && b === 254) || // link-local, including 169.254.169.254
  (a === 172 && b >= 16 && b <= 31) || // RFC 1918
  (a === 192 && b === 168) || // RFC 1918
  (a === 192 && b === 0 && _c === 2) || // documentation
  a >= 224; // multicast, reserved, broadcast

export const isPrivateAddress = (address: string): boolean => {
  const value = address.trim().toLowerCase();
  if (value.length === 0) return true;

  const v4 = IPV4.exec(value);

  if (v4) {
    const parts = v4.slice(1).map(Number);
    if (parts.some((part) => part > 255)) return true;

    return isPrivateV4(parts[0], parts[1], parts[2], parts[3]);
  }

  // An IPv4-mapped address reaches an IPv4 destination, so it is judged as one.
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(value);
  if (mapped) return isPrivateAddress(mapped[1]);

  if (!value.includes(":")) return true;

  if (value === "::" || value === "::1") return true;
  // fc00::/7 unique-local, fe80::/10 link-local, ff00::/8 multicast.
  if (/^f[cd][0-9a-f]{0,2}:/.test(value)) return true;
  if (/^fe[89ab][0-9a-f]?:/.test(value)) return true;
  if (/^ff[0-9a-f]{0,2}:/.test(value)) return true;

  return false;
};
