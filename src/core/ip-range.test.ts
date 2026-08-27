import { describe, expect, it } from "vitest";
import { isPrivateAddress } from "./ip-range";

describe("isPrivateAddress", () => {
  it("rejects loopback", () => {
    expect(isPrivateAddress("127.0.0.1")).toBe(true);
    expect(isPrivateAddress("127.9.9.9")).toBe(true);
    expect(isPrivateAddress("::1")).toBe(true);
  });

  it("rejects the cloud metadata address, which is the one that leaks credentials", () => {
    expect(isPrivateAddress("169.254.169.254")).toBe(true);
  });

  it("rejects RFC 1918 ranges", () => {
    expect(isPrivateAddress("10.0.0.1")).toBe(true);
    expect(isPrivateAddress("172.16.0.1")).toBe(true);
    expect(isPrivateAddress("172.31.255.255")).toBe(true);
    expect(isPrivateAddress("192.168.1.1")).toBe(true);
  });

  it("allows a public address either side of a private range", () => {
    expect(isPrivateAddress("172.15.0.1")).toBe(false);
    expect(isPrivateAddress("172.32.0.1")).toBe(false);
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
    expect(isPrivateAddress("1.1.1.1")).toBe(false);
  });

  it("rejects carrier-grade NAT, broadcast and unspecified", () => {
    expect(isPrivateAddress("100.64.0.1")).toBe(true);
    expect(isPrivateAddress("255.255.255.255")).toBe(true);
    expect(isPrivateAddress("0.0.0.0")).toBe(true);
  });

  it("rejects IPv6 unique-local and link-local", () => {
    expect(isPrivateAddress("fd00::1")).toBe(true);
    expect(isPrivateAddress("fe80::1")).toBe(true);
  });

  it("rejects an IPv4-mapped IPv6 address that points somewhere private", () => {
    // ::ffff:127.0.0.1 reaches loopback while looking like IPv6.
    expect(isPrivateAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateAddress("::ffff:8.8.8.8")).toBe(false);
  });

  it("treats anything it cannot parse as private, because guessing favours the attacker", () => {
    expect(isPrivateAddress("not-an-address")).toBe(true);
    expect(isPrivateAddress("")).toBe(true);
  });
});
