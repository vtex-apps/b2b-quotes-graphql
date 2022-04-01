import readFile from '../utils/readFile'

const MESSAGE_BODY = readFile('../assets/quotePlaced.html')

export const quotePlacedMessage = {
  FriendlyName: 'Quote Placed',
  IsDefaultTemplate: false,
  IsPersisted: true,
  IsRemoved: false,
  Name: 'quote-order-placed',
  // Description: null,
  // AccountId: null,
  // AccountName: null,
  // ApplicationId: null,
  Templates: {
    email: {
      IsActive: true,
      Message: MESSAGE_BODY,
      ProviderId: '00000000-0000-0000-0000-000000000000',
      Subject: '[{{quote.organization}}] Quote Placed',
      // CC: null,
      // BCC: null,
      To: '{{message.to}}',
      Type: 'E',
      // ProviderName: null,
      withError: false,
    },
    sms: {
      // ProviderId: null,
      // ProviderName: null,
      IsActive: false,
      Parameters: [],
      Type: 'S',
      withError: false,
    },
  },
  Type: '',
}
