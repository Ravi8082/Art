import { Image } from 'expo-image';
import * as DocumentPicker from 'expo-document-picker';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  type ScrollViewInstance,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { WebView } from 'react-native-webview';
import {
  HaatButton,
  HaatText as Text,
  MessageState,
  styles,
} from '@/components/haat-ui';
import { theme, typography } from '@/constants/theme';
import { api, getApiErrorMessage, resolveMediaUrl, type HomepageMedia, type SiteContent } from '@/lib/api';
import { useRefreshOnFocus } from '@/lib/query-refresh';

const categories = [
  { label: 'General Enquiries', value: 'General' },
  { label: 'Exhibition / Stall Booking', value: 'Exhibition/Stall Booking' },
  { label: 'Artist Enquiries', value: 'Artist' },
  { label: 'Partnerships', value: 'Partnership' },
  { label: 'Media', value: 'Media' },
  { label: 'Sponsorship', value: 'Sponsorship' },
  { label: 'Technical Support', value: 'Technical Support' },
] as const;

const quickCategories = [
  {
    label: 'Exhibitions',
    detail: 'Stall booking, edition details & participation',
    value: 'Exhibition/Stall Booking',
    icon: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  },
  {
    label: 'Artist Onboarding',
    detail: 'Register, showcase & grow with us',
    value: 'Artist',
    icon: { ios: 'person.crop.circle', android: 'person', web: 'person' },
  },
  {
    label: 'Partnerships',
    detail: 'Collaborations, sponsorships & CSR',
    value: 'Partnership',
    icon: { ios: 'person.2', android: 'handshake', web: 'handshake' },
  },
  {
    label: 'Media & Press',
    detail: 'Press kit, interviews & coverage',
    value: 'Media',
    icon: { ios: 'camera', android: 'photo_camera', web: 'photo_camera' },
  },
  {
    label: 'General Enquiries',
    detail: 'Any other questions or support',
    value: 'General',
    icon: { ios: 'info.circle', android: 'info', web: 'info' },
  },
] as const;

const attachmentTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const maxAttachmentBytes = 5 * 1024 * 1024;
const faqs = [
  {
    question: 'How do I ask about an exhibition stall?',
    answer: 'Choose Exhibition / Stall Booking in the enquiry form and send your request. The app will show a reference code once it is recorded.',
  },
  {
    question: 'I am an artist. Which category should I select?',
    answer: 'Select Artist Enquiries and include a few details about your work in the message.',
  },
  {
    question: 'How do I reach the team about a partnership or sponsorship?',
    answer: 'Choose Partnerships or Sponsorship in the enquiry form so your message is routed with the right topic.',
  },
  {
    question: 'Can I attach a portfolio or document?',
    answer: 'Yes. One optional PDF or image can be attached to your enquiry, up to 5 MB.',
  },
];

type PublicContactSettings = {
  address: string;
  phones: string[];
  email: string;
  hours: string;
  socialLinks: { label: string; url: string }[];
};

type SelectedAttachment = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
};

type ContactTab = 'enquiry' | 'support';

export default function ContactScreen() {
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const [activeTab, setActiveTab] = useState<ContactTab>('enquiry');
  const [enquirySectionTop, setEnquirySectionTop] = useState(0);
  const [formTopWithinSection, setFormTopWithinSection] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<(typeof categories)[number]['value']>('General');
  const [consent, setConsent] = useState(false);
  const [attachment, setAttachment] = useState<SelectedAttachment | null>(null);
  const [attachmentError, setAttachmentError] = useState('');
  const [attachmentWarning, setAttachmentWarning] = useState('');
  const [notice, setNotice] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useRefreshOnFocus('contact');

  const contact = useQuery({
    queryKey: ['contact', 'settings'],
    queryFn: async () => (await api.get<{ contact: PublicContactSettings }>('/settings/contact')).data.contact,
  });
  const siteContent = useQuery({
    queryKey: ['contact', 'content'],
    queryFn: async () => (await api.get<SiteContent>('/content')).data,
  });
  const media = useQuery({
    queryKey: ['contact', 'media'],
    queryFn: async () => (await api.get<Record<string, HomepageMedia>>('/homepage/media')).data,
  });

  const sendEnquiry = useMutation({
    mutationFn: async () => {
      if (name.trim().length < 2) throw new Error('Please enter your full name.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) throw new Error('Please enter a valid email address.');
      if (phone.trim() && !/^[0-9+()\s-]{6,30}$/.test(phone.trim())) throw new Error('Use digits, spaces and + ( ) - only for your phone number.');
      if (subject.trim().length < 3) throw new Error('Add a short subject (at least 3 characters).');
      if (message.trim().length < 10) throw new Error('Tell us a little more — at least 10 characters.');
      if (!consent) throw new Error('Please accept the privacy notice before sending your enquiry.');

      const { data } = await api.post<{ id?: string; refCode: string }>('/contact', {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        category,
        subject: subject.trim(),
        message: message.trim(),
        consent: true,
        source: 'direct',
        medium: null,
        campaign: null,
        marketingEmailConsent: false,
        marketingWhatsAppConsent: false,
      });

      let uploadError = '';
      if (attachment && data.id) {
        try {
          const fileResponse = await fetch(attachment.uri);
          const file = await fileResponse.blob();
          if (file.size === 0) throw new Error('The selected file could not be read.');
          if (file.size > maxAttachmentBytes) throw new Error('Attachments must be 5 MB or smaller.');
          await api.post(`/contact/${encodeURIComponent(data.id)}/attachment`, file, {
            headers: {
              'Content-Type': attachment.mimeType,
              'X-File-Name': encodeURIComponent(attachment.name),
            },
          });
        } catch (error) {
          uploadError = getApiErrorMessage(error);
        }
      } else if (attachment) {
        uploadError = 'The enquiry was recorded, but the attachment could not be linked to it.';
      }

      return { refCode: data.refCode, uploadError };
    },
    onSuccess: ({ refCode, uploadError }) => {
      setNotice(`Message received. Your enquiry reference is ${refCode}. Our team replies within two working days.`);
      setAttachmentError('');
      setAttachmentWarning(uploadError ? `Your enquiry was saved, but the attachment could not be added: ${uploadError}` : '');
      setErrorMessage('');
      setName('');
      setEmail('');
      setPhone('');
      setSubject('');
      setMessage('');
      setCategory('General');
      setConsent(false);
      setAttachment(null);
    },
    onError: (error) => {
      setErrorMessage(getApiErrorMessage(error));
      setNotice('');
      setAttachmentWarning('');
    },
  });

  const text = siteContent.data?.text ?? {};
  const heroImage = resolveMediaUrl(media.data?.contactHero?.url ?? media.data?.hero?.url);
  const address = contact.data?.address?.trim() ?? '';
  const configuredMapUrl = text.contactMapUrl?.trim() ?? '';
  const directionsUrl = configuredMapUrl || (address ? `https://maps.google.com/?q=${encodeURIComponent(address)}` : '');
  const embedMapUrl = configuredMapUrl.includes('output=embed')
    ? configuredMapUrl
    : address
      ? `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`
      : '';
  const refreshing = contact.isRefetching || siteContent.isRefetching || media.isRefetching;

  async function openExternalLink(url: string) {
    try {
      await Linking.openURL(url);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    }
  }

  async function chooseAttachment() {
    setAttachmentError('');
    setAttachmentWarning('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: attachmentTypes,
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      const extension = file.name.split('.').pop()?.toLowerCase();
      const extensionMimeType = extension === 'pdf'
        ? 'application/pdf'
        : extension === 'jpg' || extension === 'jpeg'
          ? 'image/jpeg'
          : extension === 'png'
            ? 'image/png'
            : extension === 'webp'
              ? 'image/webp'
              : extension === 'gif'
                ? 'image/gif'
                : '';
      const mimeType = file.mimeType && attachmentTypes.includes(file.mimeType)
        ? file.mimeType
        : extensionMimeType;
      if (!mimeType) {
        setAttachmentError('Attachments can be PDF, JPG, PNG, WebP or GIF.');
        return;
      }
      if (file.size !== undefined && file.size > maxAttachmentBytes) {
        setAttachmentError('Attachments must be 5 MB or smaller.');
        return;
      }
      setAttachment({ uri: file.uri, name: file.name, mimeType, size: file.size });
    } catch (error) {
      setAttachmentError(`The file could not be selected: ${getApiErrorMessage(error)}`);
    }
  }

  function selectEnquiryCategory(value: (typeof categories)[number]['value']) {
    setCategory(value);
    setActiveTab('enquiry');
    requestAnimationFrame(scrollToForm);
  }

  function scrollToForm() {
    scrollRef.current?.scrollTo({ y: enquirySectionTop + formTopWithinSection, animated: true });
  }

  return (
    <SafeAreaView style={styles.page} edges={['bottom']}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { gap: 20, paddingBottom: 32 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void Promise.all([contact.refetch(), siteContent.refetch(), media.refetch()])}
            tintColor={theme.champagne}
          />
        }
        showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 20, borderWidth: 1, gap: 14, padding: 16 }}>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 142 }}>
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={{ color: theme.champagne, fontFamily: typography.sansSemibold, fontSize: 10, letterSpacing: 2 }}>
                CONTACT US
              </Text>
              <Text style={{ color: theme.cream, fontFamily: typography.display, fontSize: 30, lineHeight: 33 }}>
                {text.contactHeroTitle?.trim() || "Let's"}{' '}
                <Text style={{ color: theme.cream, fontFamily: typography.displayItalic, fontSize: 30, lineHeight: 33 }}>
                  {text.contactHeroAccent?.trim() || 'Collaborate'}
                </Text>
              </Text>
              <Text numberOfLines={4} style={{ color: theme.muted, fontSize: 12, lineHeight: 18 }}>
                {text.contactHeroIntro?.trim() || 'Get in touch for exhibitions, partnerships, artist onboarding, media or general enquiries.'}
              </Text>
            </View>
            {heroImage ? (
              <Image
                source={{ uri: heroImage }}
                contentFit="cover"
                accessibilityLabel={media.data?.contactHero?.altText ?? media.data?.hero?.altText ?? 'Artwork from The Haat of Art'}
                style={{ borderColor: theme.border, borderRadius: 14, borderWidth: 1, height: 128, width: 116 }}
              />
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => { setActiveTab('enquiry'); requestAnimationFrame(scrollToForm); }}
              style={{ alignItems: 'center', backgroundColor: theme.terracotta, borderRadius: 22, flexGrow: 1, justifyContent: 'center', minHeight: 39, paddingHorizontal: 13 }}>
              <Text style={{ color: '#FFFFFF', fontFamily: typography.sansSemibold, fontSize: 11 }}>Get in Touch  →</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => { setActiveTab('support'); scrollRef.current?.scrollTo({ y: 0, animated: true }); }}
              style={{ alignItems: 'center', borderColor: theme.champagne, borderRadius: 22, borderWidth: 1, flexGrow: 1, justifyContent: 'center', minHeight: 39, paddingHorizontal: 13 }}>
              <Text style={{ color: theme.cream, fontFamily: typography.sansMedium, fontSize: 11 }}>Visit Us</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => selectEnquiryCategory('Partnership')}
              style={{ alignItems: 'center', borderColor: theme.champagne, borderRadius: 22, borderWidth: 1, flexGrow: 1, justifyContent: 'center', minHeight: 39, paddingHorizontal: 13 }}>
              <Text style={{ color: theme.cream, fontFamily: typography.sansMedium, fontSize: 11 }}>Partner With Us</Text>
            </Pressable>
          </View>
        </View>

        {text.contactNotice?.trim() ? (
          <View style={{ backgroundColor: theme.surfaceRaised, borderColor: theme.border, borderRadius: 14, borderWidth: 1, padding: 14 }}>
            <Text style={{ color: theme.cream, fontSize: 13, lineHeight: 20 }}>{text.contactNotice.trim()}</Text>
          </View>
        ) : null}

        <View accessibilityRole="tablist" style={{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 16, borderWidth: 1, flexDirection: 'row', padding: 5 }}>
          {([
            { id: 'enquiry', label: 'Contact & Enquiry' },
            { id: 'support', label: 'Support & Location' },
          ] as const).map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setActiveTab(tab.id)}
                style={{
                  alignItems: 'center',
                  backgroundColor: selected ? theme.terracotta : 'transparent',
                  borderRadius: 12,
                  flex: 1,
                  justifyContent: 'center',
                  minHeight: 44,
                  paddingHorizontal: 8,
                }}>
                <Text style={{ color: selected ? '#FFFFFF' : theme.muted, fontFamily: typography.sansSemibold, fontSize: 12 }}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {activeTab === 'enquiry' ? (
          <View onLayout={(event) => setEnquirySectionTop(event.nativeEvent.layout.y)} style={{ gap: 18 }}>
            <SectionHeading title="Get in Touch With Us For" />
            {[quickCategories.slice(0, 3), quickCategories.slice(3)].map((row, rowIndex) => (
              <View key={rowIndex} style={{ flexDirection: 'row', gap: 9 }}>
                {row.map((item) => {
                  const selected = category === item.value;
                  return (
                    <Pressable
                      key={item.value}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => selectEnquiryCategory(item.value)}
                      style={{
                        alignItems: 'center',
                        backgroundColor: selected ? theme.surfaceRaised : theme.surface,
                        borderColor: selected ? theme.terracotta : theme.border,
                        borderRadius: 14,
                        borderWidth: 1,
                        flex: 1,
                        gap: 5,
                        justifyContent: 'center',
                        minHeight: 94,
                        paddingHorizontal: 8,
                        paddingVertical: 10,
                      }}>
                      <SymbolView name={item.icon} tintColor={theme.champagne} size={21} />
                      <Text numberOfLines={2} style={{ color: theme.cream, fontFamily: typography.sansSemibold, fontSize: 11, lineHeight: 15, textAlign: 'center' }}>
                        {item.label}
                      </Text>
                      <Text numberOfLines={2} style={{ color: theme.muted, fontSize: 9, lineHeight: 13, textAlign: 'center' }}>
                        {item.detail}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}

            <View
              onLayout={(event) => setFormTopWithinSection(event.nativeEvent.layout.y)}
              style={[styles.surface, { gap: 14 }]}>
              <SectionHeading title="Send Us a Message" detail="Fields marked with * are required." />
              <ContactField label="Full name *">
                <TextInput
                  accessibilityLabel="Full name"
                  autoCapitalize="words"
                  autoComplete="name"
                  maxLength={160}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={theme.subtle}
                  style={fieldInputStyle}
                  value={name}
                />
              </ContactField>
              <ContactField label="Email address *">
                <TextInput
                  accessibilityLabel="Email address"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  maxLength={255}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={theme.subtle}
                  style={fieldInputStyle}
                  value={email}
                />
              </ContactField>
              <ContactField label="Mobile number">
                <TextInput
                  accessibilityLabel="Mobile number"
                  autoComplete="tel"
                  keyboardType="phone-pad"
                  maxLength={30}
                  onChangeText={setPhone}
                  placeholder="Optional"
                  placeholderTextColor={theme.subtle}
                  style={fieldInputStyle}
                  value={phone}
                />
              </ContactField>
              <ContactField label="Subject *">
                <TextInput
                  accessibilityLabel="Subject"
                  maxLength={200}
                  onChangeText={setSubject}
                  placeholder="What is this about?"
                  placeholderTextColor={theme.subtle}
                  style={fieldInputStyle}
                  value={subject}
                />
              </ContactField>
              <ContactField label="Your message *">
                <TextInput
                  accessibilityLabel="Your message"
                  maxLength={5000}
                  multiline
                  onChangeText={setMessage}
                  placeholder="Share a few details so our team can help."
                  placeholderTextColor={theme.subtle}
                  style={[fieldInputStyle, { minHeight: 126, textAlignVertical: 'top' }]}
                  value={message}
                />
              </ContactField>

              <View style={{ gap: 8 }}>
                <Text style={{ color: theme.cream, fontFamily: typography.sansSemibold, fontSize: 12 }}>Attachment (optional)</Text>
                <View style={{ alignItems: 'center', borderColor: theme.border, borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, flexDirection: 'row', gap: 10, minHeight: 50, paddingHorizontal: 13 }}>
                  <Pressable accessibilityRole="button" onPress={() => void chooseAttachment()} style={{ alignItems: 'center', flex: 1, flexDirection: 'row', gap: 10, minHeight: 48 }}>
                    <Text style={{ color: theme.champagne, fontSize: 18 }}>＋</Text>
                    <Text numberOfLines={1} style={{ color: theme.muted, flex: 1, fontSize: 12 }}>
                      {attachment ? attachment.name : 'Add PDF or image · max 5 MB'}
                    </Text>
                  </Pressable>
                  {attachment ? (
                    <Pressable
                      accessibilityLabel="Remove attachment"
                      accessibilityRole="button"
                      onPress={() => { setAttachment(null); setAttachmentError(''); }}
                      style={{ padding: 4 }}>
                      <Text style={{ color: theme.terracotta, fontSize: 12 }}>Remove</Text>
                    </Pressable>
                  ) : null}
                </View>
                {attachment?.size !== undefined ? (
                  <Text style={{ color: theme.subtle, fontSize: 11 }}>{formatFileSize(attachment.size)}</Text>
                ) : null}
                {attachmentError ? <Text style={styles.errorText}>{attachmentError}</Text> : null}
              </View>

              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consent }}
                onPress={() => setConsent((value) => !value)}
                style={{ alignItems: 'flex-start', flexDirection: 'row', gap: 10, paddingVertical: 3 }}>
                <View style={{
                  alignItems: 'center',
                  backgroundColor: consent ? theme.terracotta : theme.surfaceRaised,
                  borderColor: consent ? theme.terracotta : theme.border,
                  borderRadius: 5,
                  borderWidth: 1,
                  height: 21,
                  justifyContent: 'center',
                  marginTop: 1,
                  width: 21,
                }}>
                  {consent ? <Text style={{ color: '#FFFFFF', fontSize: 13 }}>✓</Text> : null}
                </View>
                <Text style={{ color: theme.muted, flex: 1, fontSize: 12, lineHeight: 18 }}>
                  I agree that The Haat of Art may contact me about this enquiry. This consent is required to send your message.
                </Text>
              </Pressable>

              {notice ? (
                <View accessibilityRole="status" style={{ backgroundColor: 'rgba(154,201,162,0.1)', borderColor: theme.success, borderRadius: 12, borderWidth: 1, gap: 6, padding: 12 }}>
                  <Text style={{ color: theme.success, fontFamily: typography.sansSemibold, fontSize: 13, lineHeight: 19 }}>{notice}</Text>
                  {attachmentWarning ? <Text style={{ color: theme.danger, fontSize: 12, lineHeight: 18 }}>{attachmentWarning}</Text> : null}
                </View>
              ) : null}
              {errorMessage ? <Text accessibilityRole="alert" style={styles.errorText}>{errorMessage}</Text> : null}
              <HaatButton
                label={sendEnquiry.isPending ? 'Sending message…' : 'Send message'}
                onPress={() => sendEnquiry.mutate()}
                disabled={sendEnquiry.isPending}
              />
              <Text style={{ color: theme.subtle, fontSize: 11, lineHeight: 17, textAlign: 'center' }}>
                Your information is used to respond to this enquiry. Marketing updates are not enabled by this form.
              </Text>
            </View>
            {contact.data?.email ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => void openExternalLink(`mailto:${contact.data.email}`)}
                style={{ alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 12, padding: 14 }}>
                <View style={{ alignItems: 'center', backgroundColor: theme.surfaceRaised, borderRadius: 11, height: 40, justifyContent: 'center', width: 40 }}>
                  <SymbolView name={{ ios: 'envelope', android: 'mail', web: 'mail' }} tintColor={theme.champagne} size={20} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ color: theme.cream, fontFamily: typography.display, fontSize: 18 }}>Prefer Email?</Text>
                  <Text style={{ color: theme.muted, fontSize: 11 }}>Write to us at</Text>
                  <Text style={{ color: theme.champagne, fontSize: 12 }}>{contact.data.email}</Text>
                </View>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={{ gap: 18 }}>
            <SectionHeading title="Quick Support" detail="Need immediate help? Reach out to our team." />
            {contact.isPending ? (
              <MessageState title="Loading contact details" description="Getting the latest contact information from our website." loading />
            ) : contact.isError ? (
              <MessageState title="Contact details could not load" description={getApiErrorMessage(contact.error)} />
            ) : null}

            <View style={[styles.surface, { gap: 12 }]}>
              {contact.data ? (
                <View style={{ gap: 13 }}>
                  {contact.data.phones.map((value) => (
                    <Pressable
                      key={value}
                      accessibilityRole="link"
                      onPress={() => void openExternalLink(`tel:${value.replace(/[^\d+]/g, '')}`)}
                      style={{ alignItems: 'center', backgroundColor: theme.surfaceRaised, borderColor: theme.border, borderRadius: 13, borderWidth: 1, flexDirection: 'row', gap: 10, minHeight: 48, paddingHorizontal: 13 }}>
                      <SymbolView name={{ ios: 'phone', android: 'call', web: 'call' }} tintColor={theme.champagne} size={19} />
                      <Text style={{ color: theme.cream, flex: 1, fontSize: 13 }}>{value}</Text>
                    </Pressable>
                  ))}
                  {contact.data.phones[0] ? (
                    <Pressable
                      accessibilityRole="link"
                      onPress={() => {
                        const digits = contact.data.phones[0].replace(/\D/g, '');
                        void openExternalLink(`https://wa.me/${digits}`);
                      }}
                      style={{ alignItems: 'center', borderColor: '#25B56A', borderRadius: 22, borderWidth: 1, flexDirection: 'row', gap: 9, justifyContent: 'center', minHeight: 42, paddingHorizontal: 12 }}>
                      <SymbolView name={{ ios: 'message', android: 'chat', web: 'chat' }} tintColor="#25B56A" size={18} />
                      <Text style={{ color: '#55D58E', fontFamily: typography.sansSemibold, fontSize: 12 }}>Chat on WhatsApp</Text>
                      <Text style={{ color: '#55D58E', fontSize: 16 }}>↗</Text>
                    </Pressable>
                  ) : null}
                  {contact.data.email ? (
                    <Pressable
                      accessibilityRole="link"
                      onPress={() => void openExternalLink(`mailto:${contact.data.email}`)}
                      style={{ alignItems: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 4, paddingTop: 2 }}>
                      <SymbolView name={{ ios: 'envelope', android: 'mail', web: 'mail' }} tintColor={theme.champagne} size={19} />
                      <Text style={{ color: theme.cream, flex: 1, fontSize: 12 }}>{contact.data.email}</Text>
                    </Pressable>
                  ) : null}
                  {contact.data.socialLinks.map((item) => (
                    <Pressable key={`${item.label}-${item.url}`} accessibilityRole="link" onPress={() => void openExternalLink(item.url)}>
                      <Text style={{ color: theme.champagne, fontSize: 12 }}>{item.label}  ↗</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={[styles.surface, { gap: 12 }]}>
              <SectionHeading title="Frequently Asked Questions" detail="Quick answers from our enquiry team." />
              {faqs.map((faq, index) => {
                const expanded = openFaq === index;
                return (
                  <Pressable
                    key={faq.question}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    onPress={() => setOpenFaq(expanded ? null : index)}
                    style={{ borderBottomColor: theme.border, borderBottomWidth: index === faqs.length - 1 ? 0 : 1, gap: 8, paddingBottom: index === faqs.length - 1 ? 0 : 12, paddingTop: 4 }}>
                    <View style={{ alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>
                      <Text style={{ color: theme.cream, flex: 1, fontFamily: typography.sansMedium, fontSize: 13, lineHeight: 19 }}>{faq.question}</Text>
                      <Text style={{ color: theme.champagne, fontSize: 18 }}>{expanded ? '−' : '+'}</Text>
                    </View>
                    {expanded ? <Text style={{ color: theme.muted, fontSize: 12, lineHeight: 19 }}>{faq.answer}</Text> : null}
                  </Pressable>
                );
              })}
            </View>

            {contact.data ? (
              <View style={[styles.surface, { gap: 13 }]}>
                <SectionHeading title="Visit Our Venue" />
                {embedMapUrl ? (
                  <View style={{ borderColor: theme.border, borderRadius: 14, borderWidth: 1, height: 195, overflow: 'hidden' }}>
                    <WebView
                      accessibilityLabel="Map showing the office location"
                      javaScriptEnabled
                      originWhitelist={['https://*', 'http://*']}
                      scrollEnabled={false}
                      source={{ uri: embedMapUrl }}
                      style={{ backgroundColor: theme.surface }}
                    />
                  </View>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ alignItems: 'center', backgroundColor: theme.surfaceRaised, borderRadius: 12, height: 42, justifyContent: 'center', width: 42 }}>
                    <SymbolView name={{ ios: 'mappin', android: 'location_on', web: 'location_on' }} tintColor={theme.champagne} size={21} />
                  </View>
                  <Text style={{ color: theme.cream, flex: 1, fontSize: 12, lineHeight: 18 }}>
                    {address || 'Address not currently listed.'}
                  </Text>
                </View>
                {directionsUrl ? (
                  <View style={{ flexDirection: 'row', gap: 9 }}>
                    <HaatButton label="Get Directions" onPress={() => void openExternalLink(directionsUrl)} style={{ flex: 1 }} />
                    <HaatButton label="Open in Maps" onPress={() => void openExternalLink(directionsUrl)} style={{ flex: 1 }} variant="secondary" />
                  </View>
                ) : null}
                <View style={{ backgroundColor: theme.surfaceRaised, borderRadius: 12, flexDirection: 'row', gap: 10, padding: 13 }}>
                  <SymbolView name={{ ios: 'clock', android: 'schedule', web: 'schedule' }} tintColor={theme.champagne} size={20} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: theme.cream, fontFamily: typography.display, fontSize: 19 }}>Office Hours</Text>
                    <Text style={{ color: theme.muted, fontSize: 12, lineHeight: 18 }}>{contact.data.hours || 'Hours not currently listed.'}</Text>
                  </View>
                </View>
              </View>
            ) : null}

            <View style={{ backgroundColor: theme.surfaceRaised, borderColor: theme.border, borderRadius: 16, borderWidth: 1, gap: 9, overflow: 'hidden', padding: 16 }}>
              {heroImage ? (
                <Image source={{ uri: heroImage }} contentFit="cover" style={{ height: '100%', opacity: 0.22, position: 'absolute', right: 0, width: '100%' }} />
              ) : null}
              <Text style={{ color: theme.champagne, fontFamily: typography.displayItalic, fontSize: 25 }}>
                {text.contactPartnersTitle?.trim() || 'Work With Us'}
              </Text>
              <Text style={{ color: theme.cream, fontSize: 12, lineHeight: 18 }}>
                {text.contactPartnersText?.trim() || 'Collaborate, exhibit or partner with The Haat of Art.'}
              </Text>
              <HaatButton label="Partner With Us  →" onPress={() => selectEnquiryCategory('Partnership')} variant="secondary" />
            </View>

            <HaatButton label="Send an enquiry" onPress={() => { setActiveTab('enquiry'); requestAnimationFrame(scrollToForm); }} />
            {errorMessage ? <Text accessibilityRole="alert" style={styles.errorText}>{errorMessage}</Text> : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeading({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 9 }}>
        <View style={{ backgroundColor: theme.terracotta, borderRadius: 2, height: 20, width: 3 }} />
        <Text style={{ color: theme.cream, fontFamily: typography.display, fontSize: 23, lineHeight: 28 }}>{title}</Text>
      </View>
      {detail ? <Text style={{ color: theme.muted, fontSize: 12, lineHeight: 18, paddingLeft: 12 }}>{detail}</Text> : null}
    </View>
  );
}

function ContactField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ color: theme.cream, fontFamily: typography.sansSemibold, fontSize: 12 }}>{label}</Text>
      {children}
    </View>
  );
}

const fieldInputStyle = {
  backgroundColor: theme.surfaceRaised,
  borderColor: theme.border,
  borderRadius: 11,
  borderWidth: 1,
  color: theme.cream,
  fontFamily: typography.sans,
  fontSize: 13,
  minHeight: 48,
  paddingHorizontal: 12,
  paddingVertical: 11,
} as const;

function formatFileSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
