import readFile from '../utils/readFile'

const MESSAGE_BODY = readFile('../assets/quoteUpdated.html')

export const quoteUpdatedMessage = {
  FriendlyName: 'Quote Updated',
  IsDefaultTemplate: false,
  IsPersisted: true,
  IsRemoved: false,
  Name: 'quote-updated',
  // Description: null,
  // AccountId: null,
  // AccountName: null,
  // ApplicationId: null,
  Templates: {
    email: {
      // CC: null,
      // BCC: null,
      IsActive: true,
      Message: MESSAGE_BODY,
      ProviderId: '00000000-0000-0000-0000-000000000000',
      Subject:
        '[{{quote.organization}}] Quote {{#if quote.expired}}Expired{{else}}Updated{{/if}}',
      To: '{{message.to}}',
      Type: 'E',
      // ProviderName: null,
      withError: false,
    },
    sms: {
      IsActive: false,
      Parameters: [],
      Type: 'S',
      // ProviderId: null,
      // ProviderName: null,
      withError: false,
    },
  },
  Type: '',
}
