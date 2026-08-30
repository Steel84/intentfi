import { describe, expect, it } from 'vitest';
import { toUserError } from '../../src/utils/errors';

describe('user-facing wallet and RPC errors', () => {
  it('explains MetaMask broadcast method failures and suggests changing RPC', () => {
    expect(toUserError(new Error('eth_sendRawTransaction: Method not found'))).toContain(
      'Change the wallet RPC and try again',
    );
  });

  it('keeps ordinary rejected wallet requests distinct', () => {
    expect(toUserError(new Error('User rejected the request'))).toBe(
      'Request rejected in your wallet.',
    );
  });
});
