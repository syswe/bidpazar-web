--
-- PostgreSQL database dump
--

\restrict 88b1NY6uLrcMNZY26Tz8J8vzBLwZzz0lMECQPzMxPnKNYGHX0bZqSbxBi2pLgqx

-- Dumped from database version 16.8
-- Dumped by pg_dump version 16.10 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: ListingStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ListingStatus" AS ENUM (
    'PENDING',
    'ACTIVE',
    'COUNTDOWN',
    'COMPLETED',
    'CANCELLED'
);


--
-- Name: NotificationType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NotificationType" AS ENUM (
    'BID_WON',
    'BID_OUTBID',
    'MESSAGE',
    'SYSTEM'
);


--
-- Name: RewardType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RewardType" AS ENUM (
    'VIEWER',
    'BIDDER',
    'CHATTER'
);


--
-- Name: SellerRequestStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SellerRequestStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


--
-- Name: SharePlatform; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SharePlatform" AS ENUM (
    'TWITTER',
    'FACEBOOK',
    'WHATSAPP',
    'TELEGRAM'
);


--
-- Name: StoryType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StoryType" AS ENUM (
    'TEXT',
    'IMAGE',
    'VIDEO'
);


--
-- Name: StreamStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StreamStatus" AS ENUM (
    'SCHEDULED',
    'LIVE',
    'ENDED',
    'CANCELLED',
    'PAUSED',
    'STARTING',
    'ENDING',
    'FAILED_TO_START',
    'INTERRUPTED'
);


--
-- Name: UserType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."UserType" AS ENUM (
    'MEMBER',
    'SELLER'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AuctionListing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuctionListing" (
    id text NOT NULL,
    "productId" text NOT NULL,
    "liveStreamId" text NOT NULL,
    "startPrice" double precision NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "countdownTime" integer,
    "countdownStart" timestamp(3) without time zone,
    "countdownEnd" timestamp(3) without time zone,
    "winningBidId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Bid; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Bid" (
    id text NOT NULL,
    amount double precision NOT NULL,
    "userId" text NOT NULL,
    "listingId" text,
    "isWinning" boolean DEFAULT false NOT NULL,
    "isBackup" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "productAuctionId" text
);


--
-- Name: Category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Category" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "parentId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    emoji text
);


--
-- Name: ChatMessage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ChatMessage" (
    id text NOT NULL,
    message text NOT NULL,
    "userId" text NOT NULL,
    "liveStreamId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Conversation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Conversation" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: LiveStream; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LiveStream" (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    "thumbnailUrl" text,
    "startTime" timestamp(3) without time zone,
    "endTime" timestamp(3) without time zone,
    "userId" text NOT NULL,
    "viewerCount" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    status public."StreamStatus" DEFAULT 'SCHEDULED'::public."StreamStatus" NOT NULL
);


--
-- Name: LiveStreamBid; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LiveStreamBid" (
    id text NOT NULL,
    amount double precision NOT NULL,
    "userId" text NOT NULL,
    "liveStreamProductId" text NOT NULL,
    "isWinning" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: LiveStreamProduct; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LiveStreamProduct" (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    "basePrice" double precision NOT NULL,
    "currentPrice" double precision DEFAULT 0 NOT NULL,
    "imageUrl" text,
    stock integer DEFAULT 1 NOT NULL,
    category text,
    tags text[] DEFAULT ARRAY[]::text[],
    "liveStreamId" text NOT NULL,
    "isActive" boolean DEFAULT false NOT NULL,
    "isAuctionMode" boolean DEFAULT true NOT NULL,
    "auctionDuration" integer,
    "startTime" timestamp(3) without time zone,
    "endTime" timestamp(3) without time zone,
    "winningBidId" text,
    "isSold" boolean DEFAULT false NOT NULL,
    "soldAt" timestamp(3) without time zone,
    "soldPrice" double precision,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Message; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Message" (
    id text NOT NULL,
    content text NOT NULL,
    "senderId" text NOT NULL,
    "receiverId" text NOT NULL,
    "conversationId" text NOT NULL,
    "isRead" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Notification" (
    id text NOT NULL,
    "userId" text NOT NULL,
    content text NOT NULL,
    type text NOT NULL,
    "isRead" boolean DEFAULT false NOT NULL,
    "relatedId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Product" (
    id text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    price double precision NOT NULL,
    currency text DEFAULT 'TRY'::text NOT NULL,
    "userId" text NOT NULL,
    "categoryId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "buyNowPrice" double precision
);


--
-- Name: ProductAuction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProductAuction" (
    id text NOT NULL,
    "productId" text NOT NULL,
    "startPrice" double precision NOT NULL,
    "currentPrice" double precision DEFAULT 0 NOT NULL,
    duration integer NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "startTime" timestamp(3) without time zone,
    "endTime" timestamp(3) without time zone,
    "winningBidId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "minimumBidIncrement" double precision DEFAULT 100 NOT NULL
);


--
-- Name: ProductMedia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProductMedia" (
    id text NOT NULL,
    url text NOT NULL,
    type text NOT NULL,
    "productId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SellerRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SellerRequest" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "fullName" text NOT NULL,
    "phoneNumber" text NOT NULL,
    email text NOT NULL,
    "productCategories" text NOT NULL,
    notes text,
    status public."SellerRequestStatus" DEFAULT 'PENDING'::public."SellerRequestStatus" NOT NULL,
    "reviewedAt" timestamp(3) without time zone,
    "reviewedBy" text,
    "reviewNotes" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Story; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Story" (
    id text NOT NULL,
    content text NOT NULL,
    type public."StoryType" DEFAULT 'TEXT'::public."StoryType" NOT NULL,
    "mediaUrl" text,
    "userId" text NOT NULL,
    views integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: StreamAnalytics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StreamAnalytics" (
    id text NOT NULL,
    "liveStreamId" text NOT NULL,
    "timestamp" timestamp(3) without time zone NOT NULL,
    "viewerCount" integer NOT NULL,
    "messageCount" integer NOT NULL,
    "bidCount" integer NOT NULL,
    revenue double precision NOT NULL,
    "avgWatchTime" integer NOT NULL,
    "peakViewers" integer NOT NULL,
    engagement double precision NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: StreamHighlight; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StreamHighlight" (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    "timestamp" integer NOT NULL,
    duration integer NOT NULL,
    "thumbnailUrl" text,
    "liveStreamId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    likes integer DEFAULT 0 NOT NULL,
    "videoUrl" text,
    views integer DEFAULT 0 NOT NULL
);


--
-- Name: StreamModeration; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StreamModeration" (
    id text NOT NULL,
    "liveStreamId" text NOT NULL,
    "userId" text NOT NULL,
    action text NOT NULL,
    reason text,
    duration integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: StreamReward; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StreamReward" (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    points integer NOT NULL,
    type text NOT NULL,
    condition jsonb NOT NULL,
    "liveStreamId" text NOT NULL,
    "userIds" text[],
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: StreamShare; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StreamShare" (
    id text NOT NULL,
    platform text NOT NULL,
    message text,
    "liveStreamId" text NOT NULL,
    "userId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: StreamViewTime; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StreamViewTime" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "liveStreamId" text NOT NULL,
    "durationInSeconds" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    name text,
    "phoneNumber" text,
    "verificationCode" text,
    "isVerified" boolean DEFAULT false NOT NULL,
    "isAdmin" boolean DEFAULT false NOT NULL,
    "videoDeviceId" text,
    "audioDeviceId" text,
    points integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "userType" public."UserType" DEFAULT 'MEMBER'::public."UserType" NOT NULL
);


--
-- Name: _RewardRecipients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."_RewardRecipients" (
    "A" text NOT NULL,
    "B" text NOT NULL
);


--
-- Name: _StreamViewers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."_StreamViewers" (
    "A" text NOT NULL,
    "B" text NOT NULL
);


--
-- Name: _UserConversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."_UserConversations" (
    "A" text NOT NULL,
    "B" text NOT NULL
);


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Data for Name: AuctionListing; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AuctionListing" (id, "productId", "liveStreamId", "startPrice", status, "countdownTime", "countdownStart", "countdownEnd", "winningBidId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Bid; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Bid" (id, amount, "userId", "listingId", "isWinning", "isBackup", "createdAt", "updatedAt", "productAuctionId") FROM stdin;
cmdw0b8nv000jyo4927b3nehe	600	cmdvvurbm0001yocjyqz11jxd	\N	t	f	2025-08-03 18:20:22.555	2025-08-03 18:20:22.555	cmdvwchah0003yotmj3qu126v
\.


--
-- Data for Name: Category; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Category" (id, name, description, "parentId", "createdAt", "updatedAt", emoji) FROM stdin;
cat-aksesuar	Aksesuar	Çanta, takı, saat ve diğer aksesuarlar	\N	2025-08-03 16:28:59.033	2025-08-03 16:28:59.033	👜
cat-antika	Antika	Tarihi değer taşıyan antika eşyalar	\N	2025-08-03 16:28:59.033	2025-08-03 16:28:59.033	🏺
cat-dekorasyon	Dekorasyon	Ev ve ofis dekorasyon ürünleri	\N	2025-08-03 16:28:59.033	2025-08-03 16:28:59.033	🎨
cat-efemera	Efemera	Kağıt üzerindeki tarihi belgeler ve materyaller	\N	2025-08-03 16:28:59.033	2025-08-03 16:28:59.033	📜
cat-elektronik	Elektronik	Elektronik cihazlar ve teknoloji ürünleri	\N	2025-08-03 16:28:59.033	2025-08-03 16:28:59.033	📱
cat-ev-yasam	Ev & Yaşam	Ev eşyaları ve yaşam ürünleri	\N	2025-08-03 16:28:59.033	2025-08-03 16:28:59.033	🏠
cat-geleneksel-sanatlar	Geleneksel Sanatlar	El sanatları ve geleneksel sanat eserleri	\N	2025-08-03 16:28:59.033	2025-08-03 16:28:59.033	🎭
cat-giyim-tekstil	Giyim & Tekstil	Giyim eşyaları ve tekstil ürünleri	\N	2025-08-03 16:28:59.033	2025-08-03 16:28:59.033	👗
cat-hobi	Hobi	Hobi malzemeleri ve koleksiyon ürünleri	\N	2025-08-03 16:28:59.033	2025-08-03 16:28:59.033	🎯
cat-karma	Karma	Çeşitli kategorilerdeki karışık ürünler	\N	2025-08-03 16:28:59.033	2025-08-03 16:28:59.033	🎲
cat-kitap-muzik	Kitap & Müzik	Kitaplar, notalar ve müzik materyalleri	\N	2025-08-03 16:28:59.033	2025-08-03 16:28:59.033	📚
cat-makine	Makine	Makineler ve endüstriyel ekipmanlar	\N	2025-08-03 16:28:59.033	2025-08-03 16:28:59.033	⚙️
cat-mobilya	Mobilya	Antika ve modern mobilyalar	\N	2025-08-03 16:28:59.033	2025-08-03 16:28:59.033	🪑
cat-numismatik	Nümismatik	Madeni paralar, banknotlar ve madalyalar	\N	2025-08-03 16:28:59.033	2025-08-03 16:28:59.033	🪙
cat-objeler	Objeler	Çeşitli objeler ve dekoratif eşyalar	\N	2025-08-03 16:28:59.033	2025-08-03 16:28:59.033	🏮
cat-ofis-kirtasiye	Ofis & Kırtasiye	Ofis malzemeleri ve kırtasiye ürünleri	\N	2025-08-03 16:28:59.033	2025-08-03 16:28:59.033	📎
cat-oyuncaklar	Oyuncaklar	Vintage ve koleksiyon oyuncakları	\N	2025-08-03 16:28:59.033	2025-08-03 16:28:59.033	🧸
cat-plak-kaset	Plak & Kaset	Müzik plakları, kasetler ve CDler	\N	2025-08-03 16:28:59.033	2025-08-03 16:28:59.033	💿
cat-porselen	Porselen	Porselen ve seramik eşyalar	\N	2025-08-03 16:28:59.033	2025-08-03 16:28:59.033	🍽️
cat-saat	Saat	Antika ve modern saatler	\N	2025-08-03 16:28:59.033	2025-08-03 16:28:59.033	⏰
cat-spor-outdoor	Spor & Outdoor	Spor ekipmanları ve açık hava ürünleri	\N	2025-08-03 16:28:59.033	2025-08-03 16:28:59.033	⚽
cat-tablo-resim	Tablo & Resim	Tablolar, resimler ve sanat eserleri	\N	2025-08-03 16:28:59.033	2025-08-03 16:28:59.033	🖼️
cat-tesbih	Tesbih	Tesbihler ve dini eşyalar	\N	2025-08-03 16:28:59.033	2025-08-03 16:28:59.033	📿
cat-yapi-market	Yapı Market	İnşaat ve yapı malzemeleri	\N	2025-08-03 16:28:59.033	2025-08-03 16:28:59.033	🔨
\.


--
-- Data for Name: ChatMessage; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ChatMessage" (id, message, "userId", "liveStreamId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Conversation; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Conversation" (id, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: LiveStream; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."LiveStream" (id, title, description, "thumbnailUrl", "startTime", "endTime", "userId", "viewerCount", "createdAt", "updatedAt", status) FROM stdin;
cmdvwdrdf0005yotm39s0tt66	asdas	sadsad	\N	2025-08-03 19:30:00	\N	cmdvvur9u0000yocja5tk1upj	0	2025-08-03 16:30:21.651	2025-08-03 18:16:54.818	LIVE
cmdw08t0w000hyo49vjqpojjg	abvccc	adsad	\N	2025-08-03 21:17:00	\N	cmdvvur9u0000yocja5tk1upj	0	2025-08-03 18:18:28.976	2025-08-03 18:18:57.203	ENDED
cmebsc1os0001yoj7bo7c736j	test	test	\N	2025-08-14 22:21:00	\N	cmdvvur9u0000yocja5tk1upj	0	2025-08-14 19:21:22.059	2025-09-09 17:58:33.293	ENDED
\.


--
-- Data for Name: LiveStreamBid; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."LiveStreamBid" (id, amount, "userId", "liveStreamProductId", "isWinning", "createdAt", "updatedAt") FROM stdin;
cmdvwurmw0005yo499o5nphle	400	cmdvvurbm0001yocjyqz11jxd	cmdvwug8x0003yo49p4d2k6m4	f	2025-08-03 16:43:35.145	2025-08-03 16:43:35.145
cmdw044cj000byo49c9igvj9a	1200	cmdvvurbm0001yocjyqz11jxd	cmdw03sjf0009yo498uix4smz	f	2025-08-03 18:14:50.372	2025-08-03 18:14:50.372
cmdw04ekm000dyo49tw5dhgup	1300	cmdvvurbm0001yocjyqz11jxd	cmdw03sjf0009yo498uix4smz	f	2025-08-03 18:15:03.623	2025-08-03 18:15:03.623
cmdw04xjk000fyo49m25v01us	1500	cmdvvurbm0001yocjyqz11jxd	cmdw03sjf0009yo498uix4smz	t	2025-08-03 18:15:28.208	2025-08-03 18:15:56.22
\.


--
-- Data for Name: LiveStreamProduct; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."LiveStreamProduct" (id, title, description, "basePrice", "currentPrice", "imageUrl", stock, category, tags, "liveStreamId", "isActive", "isAuctionMode", "auctionDuration", "startTime", "endTime", "winningBidId", "isSold", "soldAt", "soldPrice", "createdAt", "updatedAt") FROM stdin;
cmdvwftxk0007yotmjwr0680j	ABC	\N	1000	1000	\N	2	\N	{}	cmdvwdrdf0005yotm39s0tt66	f	f	\N	2025-08-03 16:31:58.28	2025-08-03 16:38:58.327	\N	f	\N	\N	2025-08-03 16:31:58.28	2025-08-03 16:38:58.328
cmdvwp04a0009yotmph2fkdxa	test	test	500	500	\N	1	\N	{}	cmdvwdrdf0005yotm39s0tt66	f	t	60	2025-08-03 16:39:06.202	2025-08-03 16:40:06.202	\N	f	\N	\N	2025-08-03 16:39:06.203	2025-08-03 16:42:53.419
cmdvwu1ed0001yo49mw1qbrtg	TEST	\N	500	500	\N	5	\N	{}	cmdvwdrdf0005yotm39s0tt66	f	f	\N	2025-08-03 16:43:01.141	2025-08-03 16:43:02.875	\N	f	\N	\N	2025-08-03 16:43:01.142	2025-08-03 16:43:02.875
cmdvwug8x0003yo49p4d2k6m4	TEST	\N	300	400	\N	1	\N	{}	cmdvwdrdf0005yotm39s0tt66	f	t	60	2025-08-03 16:43:20.384	2025-08-03 16:44:20.384	\N	f	\N	\N	2025-08-03 16:43:20.385	2025-08-03 16:43:39.129
cmdw030350007yo49o97aenkm	Tespih	kuka	500	500	\N	4	\N	{}	cmdvwdrdf0005yotm39s0tt66	f	f	\N	2025-08-03 18:13:58.193	2025-08-03 18:14:15.889	\N	f	\N	\N	2025-08-03 18:13:58.193	2025-08-03 18:14:15.89
cmdw03sjf0009yo498uix4smz	Katalin Tespih	\N	1000	1500	\N	1	\N	{}	cmdvwdrdf0005yotm39s0tt66	f	t	60	2025-08-03 18:14:55.133	2025-08-03 18:15:56.215	cmdw04xjk000fyo49m25v01us	t	2025-08-03 18:15:56.215	1500	2025-08-03 18:14:35.067	2025-08-03 18:15:56.216
\.


--
-- Data for Name: Message; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Message" (id, content, "senderId", "receiverId", "conversationId", "isRead", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Notification" (id, "userId", content, type, "isRead", "relatedId", "createdAt") FROM stdin;
cmdw0b8o2000lyo49ctgxukto	cmdvvur9u0000yocja5tk1upj	"test" ürününüz için yeni bir teklif var: 600 TL	BID_OUTBID	f	cmdvwchah0003yotmj3qu126v	2025-08-03 18:20:22.562
\.


--
-- Data for Name: Product; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Product" (id, title, description, price, currency, "userId", "categoryId", "createdAt", "updatedAt", "buyNowPrice") FROM stdin;
cmdvwcc0e0001yotmjbidty9x	test	test	500	TRY	cmdvvur9u0000yocja5tk1upj	cat-dekorasyon	2025-08-03 16:29:15.085	2025-08-03 16:29:15.085	750
\.


--
-- Data for Name: ProductAuction; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ProductAuction" (id, "productId", "startPrice", "currentPrice", duration, status, "startTime", "endTime", "winningBidId", "createdAt", "updatedAt", "minimumBidIncrement") FROM stdin;
cmdvwchah0003yotmj3qu126v	cmdvwcc0e0001yotmjbidty9x	500	600	3	ACTIVE	2025-08-03 16:29:21.929	2025-08-06 16:29:21.929	cmdw0b8nv000jyo4927b3nehe	2025-08-03 16:29:21.93	2025-08-03 18:20:22.56	100
\.


--
-- Data for Name: ProductMedia; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ProductMedia" (id, url, type, "productId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: SellerRequest; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SellerRequest" (id, "userId", "fullName", "phoneNumber", email, "productCategories", notes, status, "reviewedAt", "reviewedBy", "reviewNotes", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Story; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Story" (id, content, type, "mediaUrl", "userId", views, "isActive", "createdAt", "expiresAt") FROM stdin;
\.


--
-- Data for Name: StreamAnalytics; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."StreamAnalytics" (id, "liveStreamId", "timestamp", "viewerCount", "messageCount", "bidCount", revenue, "avgWatchTime", "peakViewers", engagement, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: StreamHighlight; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."StreamHighlight" (id, title, description, "timestamp", duration, "thumbnailUrl", "liveStreamId", "createdAt", "updatedAt", likes, "videoUrl", views) FROM stdin;
\.


--
-- Data for Name: StreamModeration; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."StreamModeration" (id, "liveStreamId", "userId", action, reason, duration, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: StreamReward; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."StreamReward" (id, title, description, points, type, condition, "liveStreamId", "userIds", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: StreamShare; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."StreamShare" (id, platform, message, "liveStreamId", "userId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: StreamViewTime; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."StreamViewTime" (id, "userId", "liveStreamId", "durationInSeconds", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."User" (id, email, username, password, name, "phoneNumber", "verificationCode", "isVerified", "isAdmin", "videoDeviceId", "audioDeviceId", points, "createdAt", "updatedAt", "userType") FROM stdin;
cmdvvurbm0001yocjyqz11jxd	watcher1@test.com	watcher1	$2a$10$bH2MlOayRB9STY6LbVU9t.PYy/YXBl04pKjO6HoRL4q.KD7T9/uKS	watcher1	\N	\N	t	f	\N	\N	0	2025-08-03 16:15:35.122	2025-08-03 16:15:35.122	MEMBER
cmdvvurdb0002yocjwa2mf2b0	watcher2@test.com	watcher2	$2a$10$IoCJVgHNaMQqz6CZz.vrCOg5k7Up9Px0jW30aGwiwPEo7UuS3NeOO	watcher2	\N	\N	t	f	\N	\N	0	2025-08-03 16:15:35.183	2025-08-03 16:15:35.183	MEMBER
cmdvvur9u0000yocja5tk1upj	streamer1@test.com	streamer1	$2a$10$ZCuu0.KarOXCyJQHXmwYiOTECc.8i1pOtTfgUc30ZtvKUkFowEVSW	streamer1	\N	\N	t	t	\N	\N	0	2025-08-03 16:15:35.059	2025-08-03 16:26:11.176	SELLER
\.


--
-- Data for Name: _RewardRecipients; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."_RewardRecipients" ("A", "B") FROM stdin;
\.


--
-- Data for Name: _StreamViewers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."_StreamViewers" ("A", "B") FROM stdin;
\.


--
-- Data for Name: _UserConversations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."_UserConversations" ("A", "B") FROM stdin;
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
81de70df-ab9b-45f5-be72-5777f774077a	0c4021e4fcbecb14561307db911472baae6a4ace57a227595b988e39f6e58095	2025-08-03 16:12:15.342475+00	20250503123458_prod	\N	\N	2025-08-03 16:12:15.294478+00	1
c7dc0082-a568-4e2b-9cc1-8d1a71feec72	3ff29b79ecfb6579ac2e9664eee8dd713679ea7c09910f0346ef5cca86b4cef0	2025-08-03 16:12:15.352956+00	20250505174837_sync_user_video_device_id	\N	\N	2025-08-03 16:12:15.342964+00	1
cf0573ea-46f1-4ff4-9896-f4a17fb32ffa	fa6c21af9e1552af2149e01da90e67cafb009e3c55f9ea5828f0af0c068da4c9	2025-08-03 16:12:15.359428+00	20250531094130_add_stories_and_user_features	\N	\N	2025-08-03 16:12:15.353379+00	1
25a5fdc1-73b1-4946-bb01-fa084629b9df	f8e273f864a7dab75007a4556d3822f382f716426d2e2097ae273e707b490a63	2025-08-03 16:12:15.366569+00	20250608223253_add_seller_requests	\N	\N	2025-08-03 16:12:15.359829+00	1
91cba3e3-2c3a-4660-b6e7-d63cf15b904f	e409eecd4cd568425b1d4c25750bea2a645857492efd5c57143cb9e0e11b9f68	2025-08-03 16:12:15.381911+00	20250623004559_sync_final_schema	\N	\N	2025-08-03 16:12:15.367196+00	1
0d8190f6-920b-4b3e-b445-fd1103a22a94	52725345ca2c68aac0405c8845c1e3b73a88631000b1307259d7fef209ac71ac	2025-08-03 16:12:19.769811+00	20250803161219_add_minimum_bid_increment	\N	\N	2025-08-03 16:12:19.767721+00	1
\.


--
-- Name: AuctionListing AuctionListing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuctionListing"
    ADD CONSTRAINT "AuctionListing_pkey" PRIMARY KEY (id);


--
-- Name: Bid Bid_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Bid"
    ADD CONSTRAINT "Bid_pkey" PRIMARY KEY (id);


--
-- Name: Category Category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Category"
    ADD CONSTRAINT "Category_pkey" PRIMARY KEY (id);


--
-- Name: ChatMessage ChatMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChatMessage"
    ADD CONSTRAINT "ChatMessage_pkey" PRIMARY KEY (id);


--
-- Name: Conversation Conversation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Conversation"
    ADD CONSTRAINT "Conversation_pkey" PRIMARY KEY (id);


--
-- Name: LiveStreamBid LiveStreamBid_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LiveStreamBid"
    ADD CONSTRAINT "LiveStreamBid_pkey" PRIMARY KEY (id);


--
-- Name: LiveStreamProduct LiveStreamProduct_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LiveStreamProduct"
    ADD CONSTRAINT "LiveStreamProduct_pkey" PRIMARY KEY (id);


--
-- Name: LiveStream LiveStream_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LiveStream"
    ADD CONSTRAINT "LiveStream_pkey" PRIMARY KEY (id);


--
-- Name: Message Message_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: ProductAuction ProductAuction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductAuction"
    ADD CONSTRAINT "ProductAuction_pkey" PRIMARY KEY (id);


--
-- Name: ProductMedia ProductMedia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductMedia"
    ADD CONSTRAINT "ProductMedia_pkey" PRIMARY KEY (id);


--
-- Name: Product Product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_pkey" PRIMARY KEY (id);


--
-- Name: SellerRequest SellerRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SellerRequest"
    ADD CONSTRAINT "SellerRequest_pkey" PRIMARY KEY (id);


--
-- Name: Story Story_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Story"
    ADD CONSTRAINT "Story_pkey" PRIMARY KEY (id);


--
-- Name: StreamAnalytics StreamAnalytics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StreamAnalytics"
    ADD CONSTRAINT "StreamAnalytics_pkey" PRIMARY KEY (id);


--
-- Name: StreamHighlight StreamHighlight_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StreamHighlight"
    ADD CONSTRAINT "StreamHighlight_pkey" PRIMARY KEY (id);


--
-- Name: StreamModeration StreamModeration_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StreamModeration"
    ADD CONSTRAINT "StreamModeration_pkey" PRIMARY KEY (id);


--
-- Name: StreamReward StreamReward_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StreamReward"
    ADD CONSTRAINT "StreamReward_pkey" PRIMARY KEY (id);


--
-- Name: StreamShare StreamShare_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StreamShare"
    ADD CONSTRAINT "StreamShare_pkey" PRIMARY KEY (id);


--
-- Name: StreamViewTime StreamViewTime_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StreamViewTime"
    ADD CONSTRAINT "StreamViewTime_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _RewardRecipients _RewardRecipients_AB_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_RewardRecipients"
    ADD CONSTRAINT "_RewardRecipients_AB_pkey" PRIMARY KEY ("A", "B");


--
-- Name: _StreamViewers _StreamViewers_AB_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_StreamViewers"
    ADD CONSTRAINT "_StreamViewers_AB_pkey" PRIMARY KEY ("A", "B");


--
-- Name: _UserConversations _UserConversations_AB_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_UserConversations"
    ADD CONSTRAINT "_UserConversations_AB_pkey" PRIMARY KEY ("A", "B");


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: AuctionListing_winningBidId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AuctionListing_winningBidId_key" ON public."AuctionListing" USING btree ("winningBidId");


--
-- Name: LiveStreamBid_liveStreamProductId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LiveStreamBid_liveStreamProductId_idx" ON public."LiveStreamBid" USING btree ("liveStreamProductId");


--
-- Name: LiveStreamBid_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LiveStreamBid_userId_idx" ON public."LiveStreamBid" USING btree ("userId");


--
-- Name: LiveStreamProduct_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LiveStreamProduct_isActive_idx" ON public."LiveStreamProduct" USING btree ("isActive");


--
-- Name: LiveStreamProduct_liveStreamId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LiveStreamProduct_liveStreamId_idx" ON public."LiveStreamProduct" USING btree ("liveStreamId");


--
-- Name: LiveStreamProduct_winningBidId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "LiveStreamProduct_winningBidId_key" ON public."LiveStreamProduct" USING btree ("winningBidId");


--
-- Name: ProductAuction_winningBidId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ProductAuction_winningBidId_key" ON public."ProductAuction" USING btree ("winningBidId");


--
-- Name: SellerRequest_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SellerRequest_createdAt_idx" ON public."SellerRequest" USING btree ("createdAt");


--
-- Name: SellerRequest_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SellerRequest_status_idx" ON public."SellerRequest" USING btree (status);


--
-- Name: SellerRequest_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SellerRequest_userId_idx" ON public."SellerRequest" USING btree ("userId");


--
-- Name: Story_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Story_createdAt_idx" ON public."Story" USING btree ("createdAt");


--
-- Name: Story_isActive_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Story_isActive_expiresAt_idx" ON public."Story" USING btree ("isActive", "expiresAt");


--
-- Name: Story_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Story_userId_idx" ON public."Story" USING btree ("userId");


--
-- Name: StreamViewTime_userId_liveStreamId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "StreamViewTime_userId_liveStreamId_key" ON public."StreamViewTime" USING btree ("userId", "liveStreamId");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_phoneNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_phoneNumber_key" ON public."User" USING btree ("phoneNumber");


--
-- Name: User_username_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_username_key" ON public."User" USING btree (username);


--
-- Name: _RewardRecipients_B_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "_RewardRecipients_B_index" ON public."_RewardRecipients" USING btree ("B");


--
-- Name: _StreamViewers_B_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "_StreamViewers_B_index" ON public."_StreamViewers" USING btree ("B");


--
-- Name: _UserConversations_B_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "_UserConversations_B_index" ON public."_UserConversations" USING btree ("B");


--
-- Name: AuctionListing AuctionListing_liveStreamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuctionListing"
    ADD CONSTRAINT "AuctionListing_liveStreamId_fkey" FOREIGN KEY ("liveStreamId") REFERENCES public."LiveStream"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AuctionListing AuctionListing_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuctionListing"
    ADD CONSTRAINT "AuctionListing_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AuctionListing AuctionListing_winningBidId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuctionListing"
    ADD CONSTRAINT "AuctionListing_winningBidId_fkey" FOREIGN KEY ("winningBidId") REFERENCES public."Bid"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Bid Bid_listingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Bid"
    ADD CONSTRAINT "Bid_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES public."AuctionListing"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Bid Bid_productAuctionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Bid"
    ADD CONSTRAINT "Bid_productAuctionId_fkey" FOREIGN KEY ("productAuctionId") REFERENCES public."ProductAuction"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Bid Bid_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Bid"
    ADD CONSTRAINT "Bid_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Category Category_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Category"
    ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public."Category"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ChatMessage ChatMessage_liveStreamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChatMessage"
    ADD CONSTRAINT "ChatMessage_liveStreamId_fkey" FOREIGN KEY ("liveStreamId") REFERENCES public."LiveStream"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ChatMessage ChatMessage_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChatMessage"
    ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LiveStreamBid LiveStreamBid_liveStreamProductId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LiveStreamBid"
    ADD CONSTRAINT "LiveStreamBid_liveStreamProductId_fkey" FOREIGN KEY ("liveStreamProductId") REFERENCES public."LiveStreamProduct"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LiveStreamBid LiveStreamBid_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LiveStreamBid"
    ADD CONSTRAINT "LiveStreamBid_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LiveStreamProduct LiveStreamProduct_liveStreamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LiveStreamProduct"
    ADD CONSTRAINT "LiveStreamProduct_liveStreamId_fkey" FOREIGN KEY ("liveStreamId") REFERENCES public."LiveStream"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LiveStreamProduct LiveStreamProduct_winningBidId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LiveStreamProduct"
    ADD CONSTRAINT "LiveStreamProduct_winningBidId_fkey" FOREIGN KEY ("winningBidId") REFERENCES public."LiveStreamBid"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LiveStream LiveStream_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LiveStream"
    ADD CONSTRAINT "LiveStream_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Message Message_conversationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES public."Conversation"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Message Message_receiverId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Message Message_senderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Notification Notification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ProductAuction ProductAuction_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductAuction"
    ADD CONSTRAINT "ProductAuction_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ProductAuction ProductAuction_winningBidId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductAuction"
    ADD CONSTRAINT "ProductAuction_winningBidId_fkey" FOREIGN KEY ("winningBidId") REFERENCES public."Bid"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ProductMedia ProductMedia_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductMedia"
    ADD CONSTRAINT "ProductMedia_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Product Product_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."Category"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Product Product_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SellerRequest SellerRequest_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SellerRequest"
    ADD CONSTRAINT "SellerRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Story Story_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Story"
    ADD CONSTRAINT "Story_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: StreamAnalytics StreamAnalytics_liveStreamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StreamAnalytics"
    ADD CONSTRAINT "StreamAnalytics_liveStreamId_fkey" FOREIGN KEY ("liveStreamId") REFERENCES public."LiveStream"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: StreamHighlight StreamHighlight_liveStreamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StreamHighlight"
    ADD CONSTRAINT "StreamHighlight_liveStreamId_fkey" FOREIGN KEY ("liveStreamId") REFERENCES public."LiveStream"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: StreamModeration StreamModeration_liveStreamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StreamModeration"
    ADD CONSTRAINT "StreamModeration_liveStreamId_fkey" FOREIGN KEY ("liveStreamId") REFERENCES public."LiveStream"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: StreamModeration StreamModeration_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StreamModeration"
    ADD CONSTRAINT "StreamModeration_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: StreamReward StreamReward_liveStreamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StreamReward"
    ADD CONSTRAINT "StreamReward_liveStreamId_fkey" FOREIGN KEY ("liveStreamId") REFERENCES public."LiveStream"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: StreamShare StreamShare_liveStreamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StreamShare"
    ADD CONSTRAINT "StreamShare_liveStreamId_fkey" FOREIGN KEY ("liveStreamId") REFERENCES public."LiveStream"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: StreamShare StreamShare_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StreamShare"
    ADD CONSTRAINT "StreamShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: StreamViewTime StreamViewTime_liveStreamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StreamViewTime"
    ADD CONSTRAINT "StreamViewTime_liveStreamId_fkey" FOREIGN KEY ("liveStreamId") REFERENCES public."LiveStream"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: StreamViewTime StreamViewTime_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StreamViewTime"
    ADD CONSTRAINT "StreamViewTime_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: _RewardRecipients _RewardRecipients_A_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_RewardRecipients"
    ADD CONSTRAINT "_RewardRecipients_A_fkey" FOREIGN KEY ("A") REFERENCES public."StreamReward"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _RewardRecipients _RewardRecipients_B_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_RewardRecipients"
    ADD CONSTRAINT "_RewardRecipients_B_fkey" FOREIGN KEY ("B") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _StreamViewers _StreamViewers_A_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_StreamViewers"
    ADD CONSTRAINT "_StreamViewers_A_fkey" FOREIGN KEY ("A") REFERENCES public."LiveStream"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _StreamViewers _StreamViewers_B_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_StreamViewers"
    ADD CONSTRAINT "_StreamViewers_B_fkey" FOREIGN KEY ("B") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _UserConversations _UserConversations_A_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_UserConversations"
    ADD CONSTRAINT "_UserConversations_A_fkey" FOREIGN KEY ("A") REFERENCES public."Conversation"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _UserConversations _UserConversations_B_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_UserConversations"
    ADD CONSTRAINT "_UserConversations_B_fkey" FOREIGN KEY ("B") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 88b1NY6uLrcMNZY26Tz8J8vzBLwZzz0lMECQPzMxPnKNYGHX0bZqSbxBi2pLgqx

