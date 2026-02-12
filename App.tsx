import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { login, register, User } from "./src/api/auth";
import {
  Product,
  ProductCategory,
  createProductOrder,
  getProductById,
  listProducts,
} from "./src/api/products";
import { PASSWORD_MIN_LENGTH } from "./src/constants";
import { API_URL } from "./src/config";
import { isValidPhoneInput, normalizePhoneForE164 } from "./src/phone";

type AuthState = {
  token: string | null;
  user: User | null;
};

type Mode = "login" | "register";
type TabKey = "home" | "saved" | "cart" | "orders" | "bonus";
type IconName = import("react").ComponentProps<typeof MaterialIcons>["name"];
type CartItem = {
  product: Product;
  quantity: number;
};

type HomeCategory = {
  key: string;
  apiCategory: ProductCategory;
  label: string;
  icon: IconName;
};

const tabs: Array<{ key: TabKey; label: string; icon: IconName; activeIcon: IconName }> = [
  { key: "home", label: "Нүүр", icon: "home", activeIcon: "home-filled" },
  { key: "saved", label: "Хадгалсан", icon: "bookmark-border", activeIcon: "bookmark" },
  { key: "cart", label: "Сагс", icon: "shopping-cart", activeIcon: "shopping-cart-checkout" },
  { key: "orders", label: "Захиалга", icon: "inventory-2", activeIcon: "inventory" },
  { key: "bonus", label: "Бонус", icon: "card-giftcard", activeIcon: "redeem" },
];

const homeCategories: HomeCategory[] = [
  { key: "food", apiCategory: "Хоол", label: "Хоол", icon: "ramen-dining" },
  { key: "grocery", apiCategory: "Хүнс", label: "Хүнс", icon: "local-grocery-store" },
  {
    key: "wholesale",
    apiCategory: "Бөөнний түгээлт",
    label: "Бөөнний түгээлт",
    icon: "local-shipping",
  },
  {
    key: "preorder",
    apiCategory: "Урьдчилсан захиалга",
    label: "Урьдчилсан захиалга",
    icon: "event-note",
  },
  {
    key: "coffee-dessert",
    apiCategory: "Кофе амттан",
    label: "Кофе амттан",
    icon: "local-cafe",
  },
  { key: "alcohol", apiCategory: "Алкохол", label: "Алкохол", icon: "wine-bar" },
  {
    key: "home-kids",
    apiCategory: "Гэр ахуй & хүүхэд",
    label: "Гэр ахуй & хүүхэд",
    icon: "child-care",
  },
  {
    key: "erdenet-made",
    apiCategory: "Эргэнэтэд үйлдвэрлэв",
    label: "Эргэнэтэд үйлдвэрлэв",
    icon: "factory",
  },
  {
    key: "gift-beauty",
    apiCategory: "Бэлэг & гоо сайхан",
    label: "Бэлэг & гоо сайхан",
    icon: "auto-awesome",
  },
  {
    key: "global-order",
    apiCategory: "Гадаад захиалга",
    label: "Гадаад захиалга",
    icon: "public",
  },
];

const formatPriceMnt = (value: number) => {
  const rounded = Math.round(value).toString();
  return rounded.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const formatDate = (value?: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString();
};

const productImageUrl = (image?: string | null) => {
  if (!image) return null;
  const host = API_URL.replace(/\/api(?:-proxy)?$/, "");
  return `${host}/files/${encodeURIComponent(image)}`;
};

const BRAND = "#1400FF";
const INPUT_PLACEHOLDER = "#6D7399";

export default function App() {
  const [mode, setMode] = useState<Mode>("login");
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string>(
    homeCategories[0].key
  );

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");

  const [auth, setAuth] = useState<AuthState>({ token: null, user: null });
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [productsBusy, setProductsBusy] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [orderName, setOrderName] = useState("");
  const [orderPhone, setOrderPhone] = useState("");
  const [orderQuantity, setOrderQuantity] = useState("1");
  const [orderNote, setOrderNote] = useState("");
  const [orderBusy, setOrderBusy] = useState(false);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [orderStatusTone, setOrderStatusTone] = useState<"success" | "error" | null>(null);

  const phoneIsValid = isValidPhoneInput(phone);
  const passwordIsValid = password.trim().length >= PASSWORD_MIN_LENGTH;
  const passwordsMatch = mode === "login" || password.trim() === confirmPassword.trim();

  const canSubmit = useMemo(
    () => phoneIsValid && passwordIsValid && passwordsMatch,
    [passwordIsValid, passwordsMatch, phoneIsValid]
  );

  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  const cartTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [cartItems]
  );
  const orderPreviewTotal = useMemo(() => {
    if (!activeProduct) return 0;
    const quantityNum = Number(orderQuantity || "1");
    const quantity = Number.isFinite(quantityNum) ? Math.max(1, Math.floor(quantityNum)) : 1;
    return activeProduct.price * quantity;
  }, [activeProduct, orderQuantity]);

  const selectedCategory =
    homeCategories.find((item) => item.key === selectedCategoryKey) ||
    homeCategories[0];

  const loadProducts = async (category?: ProductCategory) => {
    setProductsBusy(true);
    setProductsError(null);

    try {
      const result = await listProducts(category);
      if (!result.ok) {
        setProductsError(result.error);
        setProducts([]);
        return;
      }

      setProducts(result.data);
    } finally {
      setProductsBusy(false);
    }
  };

  useEffect(() => {
    if (!auth.token || activeTab !== "home") return;
    void loadProducts(selectedCategory.apiCategory);
  }, [auth.token, activeTab, selectedCategory.apiCategory]);

  const addToCart = (product: Product) => {
    setCartItems((current) => {
      const existing = current.find((item) => item.product._id === product._id);
      if (!existing) {
        return [{ product, quantity: 1 }, ...current];
      }

      return current.map((item) =>
        item.product._id === product._id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    });
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setCartItems((current) =>
      current
        .map((item) =>
          item.product._id === productId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCartItems((current) => current.filter((item) => item.product._id !== productId));
  };

  const handleCategoryPress = (category: HomeCategory) => {
    console.log("category.tap", category.key);
    setSelectedCategoryKey(category.key);
    if (auth.token && activeTab === "home") {
      void loadProducts(category.apiCategory);
    }
  };

  const openProductDetail = async (product: Product) => {
    setDetailVisible(true);
    setDetailBusy(true);
    setDetailError(null);
    setOrderStatus(null);
    setOrderStatusTone(null);

    setOrderName((auth.user?.name || "").trim());
    setOrderPhone((auth.user?.phone || "").trim());
    setOrderQuantity("1");
    setOrderNote("");
    setActiveProduct(product);

    try {
      const result = await getProductById(product._id);
      if (!result.ok) {
        setDetailError(result.error);
        return;
      }
      setActiveProduct(result.data);
    } finally {
      setDetailBusy(false);
    }
  };

  const submitProductOrder = async () => {
    if (!activeProduct || orderBusy) return;

    const customerName = orderName.trim();
    const phone = orderPhone.trim();
    const quantityNum = Number(orderQuantity || "1");
    const quantity = Number.isFinite(quantityNum) ? Math.max(1, Math.floor(quantityNum)) : 1;

    if (!customerName || !phone) {
      setOrderStatus("Нэр болон утас оруулна уу.");
      setOrderStatusTone("error");
      return;
    }

    setOrderBusy(true);
    setOrderStatus(null);
    setOrderStatusTone(null);

    try {
      const result = await createProductOrder(activeProduct._id, {
        customerName,
        phone,
        quantity,
        note: orderNote.trim() || undefined,
      });

      if (!result.ok) {
        setOrderStatus(result.error);
        setOrderStatusTone("error");
        return;
      }

      setOrderStatus(`Захиалга амжилттай. ID: ${result.data.orderId.slice(-6)}`);
      setOrderStatusTone("success");
    } finally {
      setOrderBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || busy) return;

    const normalizedPhone = normalizePhoneForE164(phone);
    if (!normalizedPhone) {
      setStatus("Please enter a valid phone number.");
      return;
    }

    if (!passwordIsValid) {
      setStatus(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }

    if (!passwordsMatch) {
      setStatus("Password confirmation does not match.");
      return;
    }

    setBusy(true);
    setStatus(null);

    try {
      const trimmedPassword = password.trim();
      const result =
        mode === "login"
          ? await login(normalizedPhone, trimmedPassword)
          : await register(normalizedPhone, trimmedPassword, name.trim() || undefined);

      if (!result.ok) {
        if (result.status === 0) {
          setStatus(`Network error. Check API host reachability. ${result.error}`);
        } else {
          setStatus(result.error);
        }
        return;
      }

      const token = result.data.token;
      if (!token) {
        setStatus("Missing token.");
        return;
      }

      setAuth({ token, user: result.data.user ?? null });
      setActiveTab("home");
      setStatus(null);
      setPassword("");
      setConfirmPassword("");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = () => {
    setAuth({ token: null, user: null });
    setActiveTab("home");
    setProducts([]);
    setProductsError(null);
    setCartItems([]);
    setDetailVisible(false);
    setActiveProduct(null);
    setOrderStatus(null);
    setOrderStatusTone(null);
    setPassword("");
    setConfirmPassword("");
    setStatus(null);
  };

  const renderHomeTab = () => (
    <View style={styles.section}>
      <Text style={styles.subHeading}>Категори</Text>

      <View style={styles.categoriesGrid}>
        {homeCategories.map((category) => {
          const active = selectedCategoryKey === category.key;
          return (
            <Pressable
              key={category.key}
              onPress={() => handleCategoryPress(category)}
              style={[styles.categoryCard, active && styles.categoryCardActive]}
            >
              <View style={[styles.categoryIconWrap, active && styles.categoryIconWrapActive]}>
                <MaterialIcons
                  name={category.icon}
                  size={22}
                  color={active ? "#ffffff" : "#8691d6"}
                />
              </View>
              <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]} numberOfLines={2}>
                {category.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.bannersWrap}>
        <Pressable style={[styles.bannerCard, styles.deliveryBanner]}>
          <Text style={styles.bannerTitle}>FREE DELIVERY</Text>
          <Text style={styles.bannerText}>Courier promotion for selected zones</Text>
        </Pressable>

        <Pressable style={[styles.bannerCard, styles.bonusBanner]}>
          <Text style={styles.bannerTitle}>BONUS</Text>
          <Text style={styles.bannerText}>Earn rewards with every purchase</Text>
        </Pressable>
      </View>

      <View style={styles.rowBetween}>
        <View>
          <Text style={styles.subHeading}>Бүтээгдэхүүн</Text>
          <Text style={styles.selectedCategoryText}>{selectedCategory.label}</Text>
        </View>
        <Pressable
          onPress={() => void loadProducts(selectedCategory.apiCategory)}
          disabled={productsBusy}
          style={[styles.secondaryButton, productsBusy && styles.buttonDisabled]}
        >
          <Text style={styles.secondaryButtonText}>
            {productsBusy ? "Refreshing..." : "Refresh"}
          </Text>
        </Pressable>
      </View>

      {productsBusy ? <ActivityIndicator style={styles.loader} color={BRAND} /> : null}
      {productsError ? <Text style={styles.status}>{productsError}</Text> : null}

      <View style={styles.productsGrid}>
        {products.map((product) => {
          const imageUrl = productImageUrl(product.image);
          const inCart = cartItems.find((item) => item.product._id === product._id)?.quantity ?? 0;

          return (
            <View key={product._id} style={styles.productCard}>
              <Pressable onPress={() => void openProductDetail(product)} style={styles.productTapArea}>
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.productImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.productImage, styles.productImageFallback]}>
                    <Text style={styles.productImageFallbackText}>No image</Text>
                  </View>
                )}

                <Text style={styles.productCategory}>{product.category}</Text>
                <Text style={styles.productName} numberOfLines={2}>
                  {product.name}
                </Text>
                <Text style={styles.productPrice}>{formatPriceMnt(product.price)} MNT</Text>
              </Pressable>

              <View style={styles.rowBetween}>
                <Pressable onPress={() => addToCart(product)} style={styles.cartButton}>
                  <Text style={styles.cartButtonText}>Add</Text>
                </Pressable>
                <Pressable
                  onPress={() => void openProductDetail(product)}
                  style={styles.detailButton}
                >
                  <Text style={styles.detailButtonText}>Details</Text>
                </Pressable>
              </View>
              {inCart > 0 ? <Text style={styles.inCartText}>In cart: {inCart}</Text> : null}
            </View>
          );
        })}
      </View>

      {!productsBusy && !productsError && products.length === 0 ? (
        <Text style={styles.emptyText}>
          {selectedCategory.label} ангилалд бүтээгдэхүүн алга байна.
        </Text>
      ) : null}
    </View>
  );

  const renderSavedTab = () => (
    <View style={styles.section}>
      <Text style={styles.subHeading}>Хадгалсан</Text>
      <View style={styles.infoCard}>
        <Text style={styles.meta}>Saved items feature coming soon.</Text>
      </View>
    </View>
  );

  const renderCartTab = () => (
    <View style={styles.section}>
      <Text style={styles.subHeading}>Сагс</Text>
      <Text style={styles.meta}>Items: {cartCount}</Text>

      <View style={styles.productsWrap}>
        {cartItems.map((item) => (
          <View key={item.product._id} style={styles.infoCard}>
            <Text style={styles.productName}>{item.product.name}</Text>
            <Text style={styles.productCategory}>{item.product.category}</Text>
            <Text style={styles.productPrice}>
              {formatPriceMnt(item.product.price)} MNT x {item.quantity}
            </Text>

            <View style={styles.row}>
              <Pressable
                onPress={() => void openProductDetail(item.product)}
                style={styles.detailSmallButton}
              >
                <Text style={styles.detailSmallButtonText}>Дэлгэрэнгүй</Text>
              </Pressable>
              <Pressable
                onPress={() => updateCartQuantity(item.product._id, -1)}
                style={styles.quantityButton}
              >
                <Text style={styles.quantityButtonText}>-</Text>
              </Pressable>
              <Pressable
                onPress={() => updateCartQuantity(item.product._id, 1)}
                style={styles.quantityButton}
              >
                <Text style={styles.quantityButtonText}>+</Text>
              </Pressable>
              <Pressable
                onPress={() => removeFromCart(item.product._id)}
                style={styles.removeButton}
              >
                <Text style={styles.removeButtonText}>Remove</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      {cartItems.length === 0 ? (
        <Text style={styles.emptyText}>Your cart is empty.</Text>
      ) : (
        <View style={styles.totalCard}>
          <Text style={styles.totalText}>Total: {formatPriceMnt(cartTotal)} MNT</Text>
          <Text style={styles.meta}>Checkout integration can be added next.</Text>
        </View>
      )}
    </View>
  );

  const renderOrdersTab = () => (
    <View style={styles.section}>
      <Text style={styles.subHeading}>Захиалга</Text>
      <View style={styles.infoCard}>
        <Text style={styles.meta}>Order tracking screen coming soon.</Text>
      </View>
    </View>
  );

  const renderBonusTab = () => (
    <View style={styles.section}>
      <Text style={styles.subHeading}>Бонус</Text>
      <View style={[styles.infoCard, styles.bonusInfoCard]}>
        <Text style={styles.bonusPoints}>1,240</Text>
        <Text style={styles.bonusCaption}>Available reward points</Text>
      </View>
      <View style={styles.infoCard}>
        <Text style={styles.meta}>Collect more points from every order.</Text>
      </View>
    </View>
  );

  const renderProductDetailModal = () => (
    <Modal
      visible={detailVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setDetailVisible(false)}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {activeProduct ? activeProduct.name : "Product Detail"}
            </Text>
            <Pressable
              onPress={() => setDetailVisible(false)}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            {detailBusy ? (
              <ActivityIndicator style={styles.loader} color={BRAND} />
            ) : detailError ? (
              <View style={styles.infoCard}>
                <Text style={styles.status}>{detailError}</Text>
              </View>
            ) : activeProduct ? (
              <>
                {productImageUrl(activeProduct.image) ? (
                  <Image
                    source={{ uri: productImageUrl(activeProduct.image) || "" }}
                    style={styles.productDetailImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.productDetailImage, styles.productImageFallback]}>
                    <Text style={styles.productImageFallbackText}>No image</Text>
                  </View>
                )}

                <View style={styles.infoCard}>
                  <Text style={styles.productCategory}>{activeProduct.category}</Text>
                  <Text style={styles.productTitleDetail}>{activeProduct.name}</Text>
                  <Text style={styles.productPriceDetail}>
                    {formatPriceMnt(activeProduct.price)} MNT
                  </Text>
                  <Text style={styles.productDescriptionDetail}>
                    {activeProduct.description?.trim() || "No description provided."}
                  </Text>
                  <Text style={styles.meta}>ID: {activeProduct._id}</Text>
                  {activeProduct.createdAt ? (
                    <Text style={styles.meta}>Created: {formatDate(activeProduct.createdAt)}</Text>
                  ) : null}
                </View>

                <View style={styles.infoCard}>
                  <Text style={styles.subHeading}>Order now</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Нэр"
                    placeholderTextColor={INPUT_PLACEHOLDER}
                    value={orderName}
                    onChangeText={setOrderName}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Утас"
                    placeholderTextColor={INPUT_PLACEHOLDER}
                    keyboardType="phone-pad"
                    value={orderPhone}
                    onChangeText={setOrderPhone}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Тоо ширхэг"
                    placeholderTextColor={INPUT_PLACEHOLDER}
                    keyboardType="number-pad"
                    value={orderQuantity}
                    onChangeText={(value) => setOrderQuantity(value.replace(/[^\d]/g, ""))}
                  />
                  <Text style={styles.meta}>Нийт дүн: {formatPriceMnt(orderPreviewTotal)} MNT</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Тайлбар (сонголтоор)"
                    placeholderTextColor={INPUT_PLACEHOLDER}
                    value={orderNote}
                    onChangeText={setOrderNote}
                    multiline
                  />
                  <Pressable
                    onPress={() => void submitProductOrder()}
                    disabled={orderBusy}
                    style={[styles.orderButton, orderBusy && styles.orderButtonDisabled]}
                  >
                    <Text style={styles.orderButtonText}>
                      {orderBusy ? "Submitting..." : "Place Order"}
                    </Text>
                  </Pressable>

                  {orderStatus ? (
                    <Text
                      style={
                        orderStatusTone === "success"
                          ? styles.successText
                          : styles.status
                      }
                    >
                      {orderStatus}
                    </Text>
                  ) : null}
                </View>
              </>
            ) : (
              <View style={styles.infoCard}>
                <Text style={styles.meta}>No product selected.</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderAuthScreen = () => (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.section}>
        <Text style={styles.title}>Yuki Ecommerce</Text>
        <Text style={styles.meta}>API: {API_URL}</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.segmentedWrap}>
          <Pressable
            onPress={() => {
              setMode("login");
              setStatus(null);
            }}
            style={[styles.segmentedButton, mode === "login" && styles.segmentedButtonActive]}
          >
            <Text style={[styles.segmentedButtonText, mode === "login" && styles.segmentedButtonTextActive]}>
              Login
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setMode("register");
              setStatus(null);
            }}
            style={[styles.segmentedButton, mode === "register" && styles.segmentedButtonActive]}
          >
            <Text style={[styles.segmentedButtonText, mode === "register" && styles.segmentedButtonTextActive]}>
              Register
            </Text>
          </Pressable>
        </View>

        {mode === "register" ? (
          <TextInput
            style={styles.input}
            placeholder="Name"
            placeholderTextColor={INPUT_PLACEHOLDER}
            autoCapitalize="words"
            value={name}
            onChangeText={setName}
          />
        ) : null}

        <TextInput
          style={styles.input}
          placeholder="Phone"
          placeholderTextColor={INPUT_PLACEHOLDER}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />

        {!phoneIsValid ? (
          <Text style={styles.hint}>Use 8 to 15 digits. Example: 94641031 or +97694641031</Text>
        ) : null}

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={INPUT_PLACEHOLDER}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          value={password}
          onChangeText={setPassword}
        />

        {!passwordIsValid ? (
          <Text style={styles.hint}>
            Password must be at least {PASSWORD_MIN_LENGTH} characters.
          </Text>
        ) : null}

        {mode === "register" ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Confirm password"
              placeholderTextColor={INPUT_PLACEHOLDER}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            {!passwordsMatch ? (
              <Text style={styles.hint}>Password confirmation does not match.</Text>
            ) : null}
          </>
        ) : null}

        <Pressable
          onPress={() => void handleSubmit()}
          disabled={!canSubmit || busy}
          style={[styles.primaryButton, (!canSubmit || busy) && styles.buttonDisabled]}
        >
          <Text style={styles.primaryButtonText}>
            {busy ? "Please wait" : mode === "login" ? "Sign in" : "Sign up"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        {busy && <ActivityIndicator color={BRAND} />}
        {status ? <Text style={styles.status}>{status}</Text> : null}
      </View>
    </ScrollView>
  );

  const renderAuthenticatedScreen = () => (
    <View style={styles.shell}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.title}>Yuki Ecommerce</Text>
          <Text style={styles.meta}>
            {auth.user?.name?.trim() || auth.user?.phone || "Active account"}
          </Text>
        </View>

        {activeTab === "home" ? renderHomeTab() : null}
        {activeTab === "saved" ? renderSavedTab() : null}
        {activeTab === "cart" ? renderCartTab() : null}
        {activeTab === "orders" ? renderOrdersTab() : null}
        {activeTab === "bonus" ? renderBonusTab() : null}

        {activeTab !== "home" ? (
          <Pressable onPress={handleLogout} style={styles.signOutButton}>
            <Text style={styles.signOutButtonText}>Sign out</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {renderProductDetailModal()}

      <View style={styles.bottomNav}>
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          const showBadge = tab.key === "cart" && cartCount > 0;
          const iconName = active ? tab.activeIcon : tab.icon;

          return (
            <Pressable
              key={tab.key}
              style={[styles.bottomItem, active && styles.bottomItemActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <View style={[styles.bottomIconWrap, active && styles.bottomIconWrapActive]}>
                <MaterialIcons name={iconName} size={20} color={active ? "#ffffff" : "#7f86b2"} />
              </View>
              <Text style={[styles.bottomLabel, active && styles.bottomLabelActive]}>
                {tab.label}
              </Text>
              {showBadge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{cartCount}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {auth.token ? renderAuthenticatedScreen() : renderAuthScreen()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  shell: {
    flex: 1,
    backgroundColor: "#000000",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 14,
    paddingBottom: 104,
  },
  section: {
    gap: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#f5f7ff",
    letterSpacing: 0.2,
  },
  subHeading: {
    fontSize: 16,
    fontWeight: "800",
    color: "#f5f7ff",
  },
  selectedCategoryText: {
    marginTop: 2,
    fontSize: 12,
    color: BRAND,
    fontWeight: "700",
  },
  meta: {
    fontSize: 12,
    color: "#98a0c4",
  },
  hint: {
    fontSize: 12,
    color: "#8b92b8",
    marginTop: -4,
  },
  value: {
    fontSize: 12,
    color: "#dce1ff",
  },
  input: {
    backgroundColor: "#15152b",
    color: "#f5f7ff",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  status: {
    fontSize: 12,
    color: "#ff6d8d",
    fontWeight: "600",
  },
  loader: {
    marginTop: 6,
  },
  segmentedWrap: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#0f0f1f",
    borderRadius: 12,
    padding: 4,
  },
  segmentedButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  segmentedButtonActive: {
    backgroundColor: BRAND,
    shadowColor: BRAND,
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  segmentedButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9ea5ca",
  },
  segmentedButtonTextActive: {
    color: "#ffffff",
  },
  primaryButton: {
    borderRadius: 12,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    shadowColor: BRAND,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryButton: {
    minWidth: 96,
    borderRadius: 999,
    backgroundColor: "#171731",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  secondaryButtonText: {
    color: "#edf0ff",
    fontSize: 12,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  categoryCard: {
    width: "31.8%",
    minHeight: 96,
    borderRadius: 16,
    backgroundColor: "#0f0f20",
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#000000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  categoryCardActive: {
    backgroundColor: "#171336",
    shadowColor: BRAND,
    shadowOpacity: 0.38,
    elevation: 4,
  },
  categoryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1f2038",
  },
  categoryIconWrapActive: {
    backgroundColor: "#2c24a8",
    shadowColor: BRAND,
    shadowOpacity: 0.34,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  categoryLabel: {
    fontSize: 11,
    lineHeight: 15,
    color: "#d7dcf6",
    textAlign: "center",
    fontWeight: "700",
  },
  categoryLabelActive: {
    color: "#ffffff",
  },
  bannersWrap: {
    gap: 10,
  },
  bannerCard: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.34,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  deliveryBanner: {
    backgroundColor: "#0f1022",
  },
  bonusBanner: {
    backgroundColor: BRAND,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 0.9,
  },
  bannerText: {
    marginTop: 4,
    fontSize: 12,
    color: "#e2e7ff",
  },
  productsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  productsWrap: {
    gap: 10,
  },
  productCard: {
    width: "48.5%",
    borderRadius: 16,
    backgroundColor: "#0d0d1b",
    padding: 10,
    gap: 6,
    shadowColor: "#000000",
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  productTapArea: {
    gap: 6,
  },
  productImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: "#191935",
  },
  productImageFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  productImageFallbackText: {
    color: "#8f96ba",
    fontSize: 12,
    fontWeight: "600",
  },
  productCategory: {
    fontSize: 11,
    fontWeight: "700",
    color: BRAND,
    textTransform: "uppercase",
  },
  productName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f2f5ff",
  },
  productPrice: {
    fontSize: 13,
    fontWeight: "700",
    color: "#f2f5ff",
  },
  productTitleDetail: {
    fontSize: 22,
    fontWeight: "800",
    color: "#f5f7ff",
  },
  productPriceDetail: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f5f7ff",
  },
  productDescriptionDetail: {
    fontSize: 13,
    lineHeight: 20,
    color: "#b4bbdc",
  },
  cartButton: {
    minWidth: 68,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
  },
  cartButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  detailButton: {
    minWidth: 68,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "#1a1a34",
    alignItems: "center",
    justifyContent: "center",
  },
  detailButtonText: {
    color: "#d7ddff",
    fontSize: 12,
    fontWeight: "700",
  },
  detailSmallButton: {
    borderRadius: 10,
    backgroundColor: "#162248",
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  detailSmallButtonText: {
    color: "#c8d6ff",
    fontSize: 12,
    fontWeight: "700",
  },
  inCartText: {
    fontSize: 11,
    color: "#969fc4",
    fontWeight: "600",
  },
  quantityButton: {
    minWidth: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#1d1d38",
    alignItems: "center",
    justifyContent: "center",
  },
  quantityButtonText: {
    color: "#eff2ff",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 18,
  },
  removeButton: {
    borderRadius: 10,
    backgroundColor: "#281227",
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  removeButtonText: {
    color: "#ffabc8",
    fontSize: 12,
    fontWeight: "700",
  },
  infoCard: {
    borderRadius: 14,
    backgroundColor: "#0e0e1d",
    padding: 12,
    gap: 8,
  },
  totalCard: {
    borderRadius: 14,
    backgroundColor: "#121226",
    padding: 12,
    gap: 6,
  },
  totalText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f2f5ff",
  },
  successText: {
    fontSize: 12,
    color: "#59ebb0",
    fontWeight: "600",
  },
  bonusInfoCard: {
    backgroundColor: "#1a1340",
  },
  bonusPoints: {
    fontSize: 28,
    fontWeight: "800",
    color: "#aea1ff",
  },
  bonusCaption: {
    fontSize: 12,
    color: "#cbc5ff",
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 12,
    color: "#8f96ba",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.82)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    maxHeight: "88%",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: "#070710",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#101021",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#f5f7ff",
  },
  modalCloseButton: {
    backgroundColor: "#1d1d36",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modalCloseText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#e9ecff",
  },
  modalContent: {
    padding: 16,
    gap: 12,
  },
  productDetailImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: "#191931",
  },
  orderButton: {
    marginTop: 2,
    borderRadius: 10,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    shadowColor: BRAND,
    shadowOpacity: 0.42,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  orderButtonDisabled: {
    opacity: 0.6,
  },
  orderButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  bottomNav: {
    flexDirection: "row",
    backgroundColor: "#090912",
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 6,
    shadowColor: "#000000",
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  bottomItem: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    position: "relative",
    gap: 4,
  },
  bottomItemActive: {
    backgroundColor: "#181734",
  },
  bottomIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(137, 144, 182, 0.12)",
  },
  bottomIconWrapActive: {
    backgroundColor: "rgba(20, 0, 255, 0.28)",
  },
  bottomLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#8c93b9",
  },
  bottomLabelActive: {
    color: "#ffffff",
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 10,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: "#ff4d67",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
  },
  signOutButton: {
    borderRadius: 999,
    backgroundColor: "#1a1a34",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  signOutButtonText: {
    color: "#edf0ff",
    fontSize: 13,
    fontWeight: "700",
  },
});
