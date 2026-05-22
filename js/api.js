/**
 * API & Cache Module
 * Fetches FAQ data from Google Apps Script and handles sessionStorage caching with TTL (Time-To-Live).
 */

// Replace this with your Google Apps Script Web App URL after deploying
export const API_CONFIG = {
    url: 'https://script.google.com/macros/s/AKfycbzP7X6AFtno9PxVzsLUgSO9RcYtZWT0NAej8kupxijZrPtbfbq53aCW09DsVJ5Lm44LlQ/exec' // Empty by default to trigger the mock data fallback
};

const CACHE_KEY = 'faq_data_cache';
const CACHE_TIME_KEY = 'faq_data_cache_time';
const CACHE_TTL_MS = 30 * 1000; // 5 minutes cache lifetime

/**
 * Fetch and parse FAQ data from API or Cache. Falls back to mock data if URL is empty or fetch fails.
 * @returns {Promise<Array>} List of FAQ items matching the schema
 */
export async function fetchFAQData() {
    // 1. Try to load from Cache first
    const cachedData = getCachedData();
    if (cachedData) {
        console.log('Loaded FAQ data from cache.');
        return cachedData;
    }

    // 2. Fetch from Google Apps Script if URL is configured
    if (API_CONFIG.url && API_CONFIG.url.trim() !== '') {
        try {
            console.log('Fetching FAQ data from Google Sheets API...');
            const response = await fetch(API_CONFIG.url);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            
            if (Array.isArray(data) && data.length > 0) {
                // Save to cache and return
                setCacheData(data);
                return data;
            }
            throw new Error('Invalid data format received from API');
        } catch (error) {
            console.warn('Failed to fetch from Google Sheets API. Falling back to local data. Error:', error);
            // Fall through to mock data
        }
    } else {
        console.log('API URL not configured. Using local mock data.');
    }

    // 3. Fall back to Mock Data
    return MOCK_FAQ_DATA;
}

/**
 * Clears the session storage cache.
 */
export function clearCache() {
    sessionStorage.removeItem(CACHE_KEY);
    sessionStorage.removeItem(CACHE_TIME_KEY);
}

// Helper: Get cache if valid
function getCachedData() {
    try {
        const cacheTime = sessionStorage.getItem(CACHE_TIME_KEY);
        const cachedContent = sessionStorage.getItem(CACHE_KEY);

        if (cacheTime && cachedContent) {
            const timePassed = Date.now() - parseInt(cacheTime, 10);
            if (timePassed < CACHE_TTL_MS) {
                return JSON.parse(cachedContent);
            }
        }
    } catch (e) {
        console.error('Failed to read theme cache:', e);
    }
    return null;
}

// Helper: Save cache with timestamp
function setCacheData(data) {
    try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
        sessionStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
    } catch (e) {
        console.error('Failed to set cache:', e);
    }
}

// Standard Mock Data matching the user schema: Category, Topic, Description, Content, Icon, Slug
const MOCK_FAQ_DATA = [
    {
        Category: 'Nhân sự',
        Topic: 'Cách xin nghỉ phép',
        Description: 'Quy trình đăng ký nghỉ phép năm, nghỉ ốm, thai sản.',
        Content: 'Để xin nghỉ phép tại công ty, bạn vui lòng thực hiện theo quy trình sau:\n\n### Quy trình đăng ký nghỉ phép\n\n1. **Truy cập hệ thống**: Đăng nhập vào cổng thông tin nhân sự **HRM Portal**.\n2. **Tạo yêu cầu**: Chọn mục **Đăng ký nghỉ phép** từ thanh công cụ bên trái.\n3. **Điền thông tin**:\n   * **Loại nghỉ**: Chọn Nghỉ phép năm, Nghỉ không lương, Nghỉ ốm hoặc Nghỉ chế độ.\n   * **Thời gian**: Chọn ngày bắt đầu và ngày kết thúc phép.\n   * **Lý do**: Nhập lý do ngắn gọn.\n   * **Người bàn giao**: Chọn nhân sự phụ trách công việc của bạn khi nghỉ phép.\n4. **Gửi duyệt**: Nhấn gửi. Hệ thống sẽ gửi email phê duyệt đến Quản lý trực tiếp (Manager) và HR.\n\n### Thời hạn đăng ký quy định\n\n| Số ngày nghỉ phép liên tục | Đăng ký trước tối thiểu |\n| :--- | :---: |\n| Dưới 3 ngày | **24 giờ làm việc** |\n| Từ 3 đến 5 ngày | **3 ngày làm việc** |\n| Trên 5 ngày | **1 tuần làm việc** |\n\n*Lưu ý*: Đối với trường hợp nghỉ ốm đột xuất, bạn cần thông báo trực tiếp cho Manager qua chat/điện thoại trước 09:00 sáng và bổ sung giấy xác nhận y tế trên hệ thống trong vòng 24 giờ sau khi đi làm lại.',
        Icon: 'file-text',
        Slug: 'xin-nghi-phep'
    },
    {
        Category: 'Nhân sự',
        Topic: 'Chính sách Bảo hiểm Xã hội',
        Description: 'Thông tin về tỷ lệ đóng bảo hiểm và cách nhận thẻ BHYT.',
        Content: 'Công ty thực hiện việc đóng Bảo hiểm xã hội (BHXH), Bảo hiểm y tế (BHYT), và Bảo hiểm thất nghiệp (BHTN) đầy đủ cho nhân viên theo quy định của Luật Lao động.\n\n### Tỷ lệ đóng BHXH chi tiết\n\n| Loại bảo hiểm | Do công ty đóng | Do nhân viên đóng | Tổng tỷ lệ |\n| :--- | :---: | :---: | :---: |\n| Bảo hiểm xã hội (BHXH) | 17.5% | 8.0% | 25.5% |\n| Bảo hiểm y tế (BHYT) | 3.0% | 1.5% | 4.5% |\n| Bảo hiểm thất nghiệp (BHTN) | 1.0% | 1.0% | 2.0% |\n| **Tổng số** | **21.5%** | **10.5%** | **32%** |\n\n### Hướng dẫn nhận thẻ BHYT điện tử\n\nCông ty đăng ký thẻ BHYT điện tử cho toàn bộ nhân viên. Để tra cứu thông tin thẻ và sử dụng thay thế thẻ giấy khi đi khám chữa bệnh, bạn thực hiện:\n\n1. Tải ứng dụng **VssID** (Bảo hiểm xã hội số) trên App Store hoặc Google Play.\n2. Đăng ký tài khoản bằng mã số BHXH công ty cung cấp.\n3. Đăng nhập và vào mục **Quản lý cá nhân** -> **Thẻ BHYT** để xuất mã QR khi khám bệnh.\n\nNếu cần cấp lại thẻ giấy hoặc hỗ trợ thủ tục thai sản, ốm đau, vui lòng liên hệ phòng nhân sự qua email `hr@company.com`.',
        Icon: 'file-text',
        Slug: 'chinh-sach-bhxh'
    },
    {
        Category: 'IT',
        Topic: 'Reset mật khẩu tài khoản',
        Description: 'Hướng dẫn tự đặt lại mật khẩu email và tài khoản mạng.',
        Content: 'Nếu bạn quên mật khẩu hoặc tài khoản Active Directory bị khóa, bạn có thể tự khôi phục trực tuyến một cách an toàn.\n\n### Hướng dẫn tự reset mật khẩu (SSPR)\n\n1. Sử dụng thiết bị cá nhân truy cập vào trang: [https://sspr.company.com](https://sspr.company.com)\n2. Nhập tên tài khoản (email công ty của bạn, ví dụ: `nam.nguyen@company.com`).\n3. Chọn hình thức nhận mã xác minh OTP qua **SMS** hoặc **Email cá nhân** đã đăng ký.\n4. Nhập mã OTP nhận được và tiến hành đặt mật khẩu mới.\n\n### Quy định về độ an toàn mật khẩu\n\n> [!IMPORTANT]\n> Mật khẩu mới phải đáp ứng các tiêu chuẩn sau:\n> * Tối thiểu **8 ký tự** trở lên.\n> * Có chứa ít nhất **1 chữ hoa** (A-Z) và **1 chữ thường** (a-z).\n> * Có chứa ít nhất **1 chữ số** (0-9).\n> * Có chứa ít nhất **1 ký tự đặc biệt** (ví dụ: `@`, `#`, `$`, `%`, `*`).\n> * Không trùng với 3 mật khẩu gần nhất.\n\nNếu hệ thống báo lỗi không thể tự reset, vui lòng gửi ticket hỗ trợ hoặc gọi hotline IT Helpdesk nội bộ: **Máy lẻ 8888**.',
        Icon: 'lock',
        Slug: 'reset-password'
    },
    {
        Category: 'IT',
        Topic: 'Kết nối VPN làm việc từ xa',
        Description: 'Cách cài đặt Cisco AnyConnect để truy cập mạng nội bộ.',
        Content: 'Để bảo mật thông tin, bạn bắt buộc phải sử dụng VPN khi truy cập các hệ thống nội bộ (như Git, HRM, Database) từ bên ngoài văn phòng.\n\n### Hướng dẫn thiết lập VPN công ty\n\n* **Bước 1: Tải ứng dụng**  \n  Tải phần mềm client **Cisco Secure Client** (AnyConnect) từ cổng phần mềm nội bộ công ty hoặc nhờ IT hỗ trợ cài đặt.\n* **Bước 2: Cấu hình kết nối**  \n  Khởi động ứng dụng, nhập địa chỉ server kết nối: `vpn.company.com` và nhấn **Connect**.\n* **Bước 3: Xác thực tài khoản**  \n  Đăng nhập bằng tài khoản email công ty và mật khẩu. Sau đó, nhập mã số OTP xác thực hai lớp (MFA) từ ứng dụng **Microsoft Authenticator** trên điện thoại cá nhân.\n\n### Một số lỗi thường gặp\n\n* **Lỗi "Connection Timeout"**: Vui lòng kiểm tra lại đường truyền mạng internet của bạn.\n* **Lỗi "Invalid Credentials"**: Đảm bảo mật khẩu email của bạn chưa bị hết hạn. Hãy thử truy cập trang Webmail trước để xác nhận.\n* **Lỗi "MFA Verification Failed"**: Kiểm tra múi giờ trên điện thoại của bạn xem có bị lệch so với múi giờ thực tế không.',
        Icon: 'lock',
        Slug: 'ket-noi-vpn'
    },
    {
        Category: 'Chính sách',
        Topic: 'Quy định giờ giấc làm việc',
        Description: 'Thông tin giờ giấc làm việc và chính sách đi trễ.',
        Content: 'Quy định về thời gian làm việc chính thức tại văn phòng và chính sách quản lý giờ giấc đi muộn, về sớm.\n\n### Thời gian làm việc quy định\n\n* **Khung giờ làm việc chính thức**:\n  * Sáng: Từ **08:30** đến **12:00**\n  * Nghỉ trưa: Từ **12:00** đến **13:00**\n  * Chiều: Từ **13:00** đến **17:30**\n* **Số ngày làm việc**: Từ thứ Hai đến thứ Sáu hằng tuần (Nghỉ thứ Bảy và Chủ nhật).\n\n### Chính sách đi trễ, về sớm\n\n1. **Thời gian ân hạn**: Công ty cho phép nhân viên đi trễ tối đa **15 phút/lần** và không quá **3 lần/tháng** đối với các sự cố khách quan (kẹt xe, thời tiết...). Sau 15 phút, bạn sẽ bị tính là đi muộn.\n2. **Trường hợp đi trễ có lý do công việc**: Nếu đi gặp đối tác hoặc công tác ngoài vào đầu giờ sáng, bạn cần làm đơn duyệt đi ngoài trên phần mềm HRM trước giờ làm việc ít nhất 30 phút để không bị tính là đi trễ.\n3. **Mức phạt quy định**: Trường hợp đi muộn quá số lần quy định không có lý do được phê duyệt sẽ bị xử lý theo nội quy lao động công ty.',
        Icon: 'scale',
        Slug: 'thoi-gio-lam-viec'
    },
    {
        Category: 'Quy trình',
        Topic: 'Quy trình thanh toán chi phí',
        Description: 'Các bước lập đề nghị thanh toán và hồ sơ chứng từ cần có.',
        Content: 'Quy trình này hướng dẫn nhân viên lập đề xuất thanh toán cho các chi phí phát sinh như đi công tác, mua sắm văn phòng phẩm, tiếp khách, v.v.\n\n### Các bước lập đề nghị thanh toán\n\n1. **Chuẩn bị hóa đơn chứng từ**: Thu thập hóa đơn giá trị gia tăng (GTGT/VAT) hợp lệ. Thông tin công ty trên hóa đơn phải chính xác:\n   * **Tên Công ty**: Công ty Cổ phần Giao Hàng Nhanh\n   * **Mã số thuế**: 0311187222\n   * **Địa chỉ**: Tầng 3, Tòa nhà Rivera Park, Số 7/28 Đường Thành Thái, Phường 14, Quận 10, Thành phố Hồ Chí Minh.\n2. **Tạo đề xuất trên phần mềm**: Đăng nhập vào hệ thống quản lý chi phí E-Office, chọn mục **Đề nghị thanh toán**.\n3. **Nhập thông tin & tải hóa đơn**: Nhập số tiền, mục đích thanh toán, thông tin tài khoản thụ hưởng. Tải ảnh chụp/file PDF hóa đơn gốc đính kèm.\n4. **Luồng phê duyệt**:\n   ```\n   Người tạo -> Trưởng bộ phận (Manager) -> Kế toán thanh toán -> Kế toán trưởng -> Ban Giám đốc\n   ```\n5. **Nhận thanh toán**: Tiền sẽ được chuyển khoản trực tiếp vào tài khoản ngân hàng của bạn vào **thứ Năm** hàng tuần sau khi hồ sơ được duyệt hoàn tất.',
        Icon: 'refresh-cw',
        Slug: 'quy-trinh-thanh-toan'
    },
    {
        Category: 'Hướng dẫn',
        Topic: 'Sử dụng máy in văn phòng',
        Description: 'Cách kết nối máy in và một số thao tác xử lý lỗi cơ bản.',
        Content: 'Tất cả các tầng văn phòng đều được trang bị máy in đa chức năng (In, Scan, Photocopy). Bạn có thể kết nối máy in theo hướng dẫn sau:\n\n### Kết nối máy in trên Windows\n\n1. Nhấn tổ hợp phím `Windows + R` để mở hộp thoại Run.\n2. Nhập địa chỉ máy chủ in ấn: `\\192.168.1.50` và nhấn **Enter**.\n3. Danh sách máy in sẽ hiện ra. Nhấp đúp vào máy in tương ứng với tầng của bạn:\n   * Tầng 2: `Canon_Tầng_2`\n   * Tầng 3: `HP_Tầng_3`\n4. Đợi hệ thống tự động cài đặt driver trong giây lát.\n\n### Kết nối máy in trên macOS\n\n1. Truy cập **System Settings** -> **Printers & Scanners**.\n2. Nhấn nút **Add Printer, Scanner, or Fax...** (Biểu tượng dấu +).\n3. Chọn tab **IP**, nhập địa chỉ IP máy in (Ví dụ: `192.168.1.52` cho Tầng 2).\n4. Chọn giao thức **LPD** và nhấn **Add** để hoàn tất.\n\n### Cách xử lý lỗi kẹt giấy cơ bản\n\n* **Bước 1**: Quan sát màn hình LCD trên máy in để biết vị trí giấy bị kẹt (Khay 1, Khay 2 hoặc Nắp bên hông).\n* **Bước 2**: Mở nắp khay hoặc nắp hông theo hướng dẫn trên màn hình.\n* **Bước 3**: Dùng cả hai tay kéo nhẹ nhàng tờ giấy bị kẹt ra ngoài theo chiều đi của giấy. **Không** giật mạnh một tay để tránh làm rách giấy và làm hỏng các trục lăn.\n* **Bước 4**: Đóng nắp máy in lại, máy sẽ tự động tiếp tục công việc đang in dở.',
        Icon: 'lightbulb',
        Slug: 'su-dung-may-in'
    },
    {
        Category: 'Khác',
        Topic: 'Đăng ký sử dụng phòng họp',
        Description: 'Quy định đặt lịch phòng họp trên Google Calendar để tránh trùng lịch.',
        Content: 'Để quản lý hiệu quả tài nguyên phòng họp và tránh việc xung đột lịch sử dụng giữa các phòng ban, toàn bộ nhân viên thực hiện đặt phòng họp theo các quy định dưới đây:\n\n### Hướng dẫn đặt phòng họp trên Google Calendar\n\n1. Mở ứng dụng **Google Calendar** bằng tài khoản email công ty.\n2. Tạo một sự kiện mới vào khung giờ bạn muốn họp.\n3. Tại cột bên phải, nhấp vào mục **Rooms** (Phòng họp).\n4. Chọn cơ sở văn phòng của bạn và nhấp chọn phòng họp còn trống tương ứng với số lượng người tham dự (VD: *Phòng họp Lớn - Tầng 3 (15 người)*).\n5. Điền tiêu đề cuộc họp (Ví dụ: `[IT] Họp giao ban tuần`), thêm người tham gia và nhấn **Save**.\n\n### Quy tắc sử dụng phòng họp\n\n* **Đúng giờ**: Giải phóng phòng họp đúng giờ đã đăng ký để các nhóm tiếp theo vào sử dụng.\n* **Hủy phòng**: Nếu cuộc họp bị hủy hoặc dời lịch, hãy cập nhật xóa phòng họp trên Calendar ngay lập tức để người khác có thể sử dụng.\n* **Vệ sinh chung**: Sau khi kết thúc họp, tắt máy chiếu/tivi, tắt điều hòa, lau bảng và xếp lại ghế ngăn nắp.',
        Icon: 'help-circle',
        Slug: 'dang-ky-phong-hop'
    }
];
