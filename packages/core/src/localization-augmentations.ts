export {};

declare module powerbi {
  interface IEnumMember {
    displayNameKey?: string;
  }
}

declare module 'powerbi-visuals-utils-formattingmodel/lib/FormattingSettingsInterfaces' {
  interface ILocalizedItemMember {
    displayName?: string;
  }
}

declare module 'powerbi-visuals-utils-formattingmodel/lib/FormattingSettingsComponents' {
  interface TextInput {
    placeholderKey?: string;
  }

  interface TextArea {
    placeholderKey?: string;
  }
}
