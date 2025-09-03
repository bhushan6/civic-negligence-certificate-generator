"use client";
import { useState, useRef, useEffect, forwardRef } from "react";

// --- Type Definitions ---
interface LocationState {
  latitude: number;
  longitude: number;
  address: string;
}
type AppStep = "initial" | "selectIssue" | "capture" | "generating" | "result";

const issueTypes = [
  "Pothole",
  "Waterlogging",
  "Garbage Dump",
  "Broken Streetlight",
  "Other",
];

// Extend the Window interface for external libraries
declare global {
  interface Window {
    QRious: unknown;
    htmlToImage: unknown;
  }
}

type LogType = "log" | "warn" | "error";

type LogArgument = string | number | boolean | null | undefined | object;

interface OriginalConsole {
  log: (...args: LogArgument[]) => void;
  warn: (...args: LogArgument[]) => void;
  error: (...args: LogArgument[]) => void;
}

interface UIElements {
  fab: HTMLButtonElement;
  panel: HTMLDivElement;
  logsContainer: HTMLDivElement;
  counter: HTMLSpanElement;
  closeButton: HTMLButtonElement;
  clearButton: HTMLButtonElement;
}

class UIConsole {
  private logCount: number = 0;
  private isOpen: boolean = false;
  private originalConsole: OriginalConsole;
  private fab!: HTMLButtonElement;
  private panel!: HTMLDivElement;
  private logsContainer!: HTMLDivElement;
  private counter!: HTMLSpanElement;
  private closeButton!: HTMLButtonElement;
  private clearButton!: HTMLButtonElement;

  constructor() {
    // Store original console methods
    this.originalConsole = {
      log: console.log.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
    };

    // Create UI elements
    this._createUI();

    // Override console methods
    this._overrideConsole();

    // Add event listeners
    this._addEventListeners();
  }

  /**
   * Creates and injects the console UI into the DOM.
   */
  private _createUI(): void {
    const container: HTMLDivElement = document.createElement("div");
    container.innerHTML = `
            <!-- Floating Action Button -->
            <button id="ui-console-fab" class="fixed bottom-4 right-4 z-50 w-16 h-16 bg-gray-800 text-white rounded-full shadow-lg flex items-center justify-center transition-transform transform hover:scale-110">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                <span id="ui-console-counter" class="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center border-2 border-gray-800">0</span>
            </button>

            <!-- Console Panel -->
            <div id="ui-console-panel" class="fixed bottom-0 left-0 right-0 z-40 h-1/2 bg-gray-900 text-white p-4 rounded-t-2xl shadow-2xl transform translate-y-full transition-transform duration-300 ease-in-out">
                <div class="flex justify-between items-center pb-2 border-b border-gray-700">
                    <h2 class="text-lg font-bold">UI Console</h2>
                    <div>
                        <button id="ui-console-clear" class="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-md mr-2">Clear</button>
                        <button id="ui-console-close" class="text-sm bg-red-500 hover:bg-red-600 px-3 py-1 rounded-md">&times; Close</button>
                    </div>
                </div>
                <div id="ui-console-logs" class="h-[calc(100%-41px)] overflow-y-auto pt-2 font-mono text-sm"></div>
            </div>
        `;
    document.body.appendChild(container);

    // Store references to the elements with proper type assertions
    this.fab = this._getElement("ui-console-fab") as HTMLButtonElement;
    this.panel = this._getElement("ui-console-panel") as HTMLDivElement;
    this.logsContainer = this._getElement("ui-console-logs") as HTMLDivElement;
    this.counter = this._getElement("ui-console-counter") as HTMLSpanElement;
    this.closeButton = this._getElement(
      "ui-console-close"
    ) as HTMLButtonElement;
    this.clearButton = this._getElement(
      "ui-console-clear"
    ) as HTMLButtonElement;
  }

  /**
   * Helper method to get DOM elements with null checking.
   */
  private _getElement(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Element with id '${id}' not found`);
    }
    return element;
  }

  /**
   * Replaces the native console methods with our custom logging function.
   */
  private _overrideConsole(): void {
    console.log = (...args: LogArgument[]): void => {
      this.originalConsole.log(...args); // Keep original behavior
      this._addLog(args, "log");
    };
    console.warn = (...args: LogArgument[]): void => {
      this.originalConsole.warn(...args);
      this._addLog(args, "warn");
    };
    console.error = (...args: LogArgument[]): void => {
      this.originalConsole.error(...args);
      this._addLog(args, "error");
    };
  }

  /**
   * Attaches event listeners to the UI elements.
   */
  private _addEventListeners(): void {
    this.fab.addEventListener("click", (): void => this.togglePanel());
    this.closeButton.addEventListener("click", (): void => this.closePanel());
    this.clearButton.addEventListener("click", (): void => this.clearLogs());
  }

  /**
   * Formats a single log argument to string.
   */
  private _formatArgument(arg: LogArgument): string {
    if (typeof arg === "object" && arg !== null) {
      try {
        // Pretty print JSON with 2 spaces
        return JSON.stringify(arg, null, 2);
      } catch (error: unknown) {
        return "[Unserializable Object]";
      }
    }
    if (arg === null) return "null";
    if (arg === undefined) return "undefined";
    return String(arg);
  }

  /**
   * Adds a log entry to the UI panel.
   * @param args - The arguments passed to the console method.
   * @param type - The type of log.
   */
  private _addLog(args: LogArgument[], type: LogType): void {
    const logEntry: HTMLDivElement = document.createElement("div");
    const timestamp: string = new Date().toLocaleTimeString();

    const typeColors: Record<LogType, string> = {
      log: "border-gray-500 text-gray-300",
      warn: "border-yellow-500 text-yellow-300",
      error: "border-red-500 text-red-400",
    };

    logEntry.className = `p-2 border-l-4 mb-2 ${typeColors[type]}`;

    const formattedArgs: string = args
      .map((arg: LogArgument): string => this._formatArgument(arg))
      .join(" ");

    // Using <pre> tag to respect formatting of stringified objects
    logEntry.innerHTML = `<span class="text-gray-500 mr-2">${timestamp}</span><pre class="inline-block whitespace-pre-wrap">${formattedArgs}</pre>`;

    this.logsContainer.appendChild(logEntry);
    // Auto-scroll to the bottom
    this.logsContainer.scrollTop = this.logsContainer.scrollHeight;

    this.logCount++;
    this.counter.textContent = this.logCount.toString();
  }

  /**
   * Toggles the visibility of the console panel.
   */
  public togglePanel(): void {
    this.isOpen = !this.isOpen;
    this.panel.classList.toggle("translate-y-full");
  }

  /**
   * Closes the console panel.
   */
  public closePanel(): void {
    if (this.isOpen) {
      this.panel.classList.add("translate-y-full");
      this.isOpen = false;
    }
  }

  /**
   * Clears all logs from the UI panel.
   */
  public clearLogs(): void {
    this.logsContainer.innerHTML = "";
    this.logCount = 0;
    this.counter.textContent = "0";
    this.originalConsole.log("UI Console Cleared.");
  }

  /**
   * Restores the original console methods.
   */
  public restore(): void {
    console.log = this.originalConsole.log;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
  }

  /**
   * Gets the current log count.
   */
  public getLogCount(): number {
    return this.logCount;
  }

  /**
   * Gets the current open state.
   */
  public isConsoleOpen(): boolean {
    return this.isOpen;
  }
}

// --- Helper Components ---

const IconCamera = ({ className }: { className: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path>
    <circle cx="12" cy="13" r="3"></circle>
  </svg>
);

const IconMapPin = ({ className }: { className: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
    <circle cx="12" cy="10" r="3"></circle>
  </svg>
);

const IconRefresh = ({ className }: { className: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M23 4v6h-6" />
    <path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const IconDownload = ({ className }: { className: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconTwitter = ({ className }: { className: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={`text-[#1DA1F2] ${className}`}
  >
    <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616v.064c0 2.298 1.635 4.212 3.793 4.649-.65.177-1.353.23-2.067.087.625 1.901 2.445 3.284 4.6 3.321-1.685 1.319-3.817 2.106-6.12 2.106-.398 0-.79-.023-1.175-.068 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
  </svg>
);

const CM_DATA = {
  "Andhra Pradesh":
    "https://upload.wikimedia.org/wikipedia/commons/a/a8/The_portrait_of_CM_Shri_Nara_Chandrababu_Naidu.jpg",
  "Arunachal Pradesh":
    "https://upload.wikimedia.org/wikipedia/commons/2/2b/Pema_Khandu_in_2018.jpg",
  Assam:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Himanta_Biswa_Sarma_in_2025.jpg/500px-Himanta_Biswa_Sarma_in_2025.jpg",
  Bihar:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Nitish_Kumar_with_JDU_functionaries_%28cropped%29.jpg/500px-Nitish_Kumar_with_JDU_functionaries_%28cropped%29.jpg",
  Chhattisgarh:
    "https://upload.wikimedia.org/wikipedia/commons/a/a4/Vishnu_Deo_Sai%2C_Chief_Minister_of_Chhattisgarh.jpg",
  Delhi:
    "https://upload.wikimedia.org/wikipedia/commons/7/72/Chief_Minister_of_Delhi%2C_Smt._Rekha_Gupta.jpg",
  Goa: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Pramod_Sawant_at_the_inauguration_of_the_Chhatrapati_Shivaji_Maharaj_Chair_in_Goa_University_%28cropped%29.jpg/500px-Pramod_Sawant_at_the_inauguration_of_the_Chhatrapati_Shivaji_Maharaj_Chair_in_Goa_University_%28cropped%29.jpg",
  Gujarat:
    "https://upload.wikimedia.org/wikipedia/commons/0/0d/Bhupendra_PAtel_Sanskrit.jpg",
  Haryana:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Nayab_Singh_Saini.jpg/500px-Nayab_Singh_Saini.jpg",
  "Himachal Pradesh":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Sukhvinder_Singh_Sukhu.jpg/500px-Sukhvinder_Singh_Sukhu.jpg",
  "Jammu & Kashmir":
    "https://upload.wikimedia.org/wikipedia/commons/6/68/Omar_Abdullah%2C_Chief_Minister_of_Jammu_%26_Kashmir.jpg",
  Jharkhand:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Hemant_Soren_2024.jpg/500px-Hemant_Soren_2024.jpg",
  Karnataka:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Siddaramaiah_at_the_function_to_commemorate_the_serving_of_2_billion_meals_of_the_Akshaya_Patra_Foundation_in_Karnataka_%28cropped%29.jpg/419px-Siddaramaiah_at_the_function_to_commemorate_the_serving_of_2_billion_meals_of_the_Akshaya_Patra_Foundation_in_Karnataka_%28cropped%29.jpg",
  Kerala:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Chief_Minister_Pinarayi_Vijayan_2023.tif/lossy-page1-500px-Chief_Minister_Pinarayi_Vijayan_2023.tif.jpg",
  "Madhya Pradesh":
    "https://upload.wikimedia.org/wikipedia/commons/5/58/Mohan_Yadav%2C_Chief_Minister_of_Madhya_Pradesh.jpg",
  Maharashtra:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Devendra_Fadnavis_%40Vidhan_Sabha_04-03-2021.jpg/500px-Devendra_Fadnavis_%40Vidhan_Sabha_04-03-2021.jpg",
  Manipur: "",
  Meghalaya:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/The_Chief_Minister_of_Meghalaya%2C_Shri_Conrad_Sangma.JPG/500px-The_Chief_Minister_of_Meghalaya%2C_Shri_Conrad_Sangma.JPG",
  Mizoram:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Lalduhawma1.jpg/500px-Lalduhawma1.jpg",
  Nagaland:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/NeiphiuRio.jpg/500px-NeiphiuRio.jpg",
  Odisha:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/%E0%AC%B6%E0%AD%8D%E0%AC%B0%E0%AD%80_%E0%AC%AE%E0%AD%8B%E0%AC%B9%E0%AC%A8_%E0%AC%9A%E0%AC%B0%E0%AC%A3_%E0%AC%AE%E0%AC%BE%E0%AC%9D%E0%AD%80.jpg/500px-%E0%AC%B6%E0%AD%8D%E0%AC%B0%E0%AD%80_%E0%AC%AE%E0%AD%8B%E0%AC%B9%E0%AC%A8_%E0%AC%9A%E0%AC%B0%E0%AC%A3_%E0%AC%AE%E0%AC%BE%E0%AC%9D%E0%AD%80.jpg",
  Puducherry:
    "https://upload.wikimedia.org/wikipedia/commons/0/08/N._Rangaswami.jpg",
  Punjab:
    "https://upload.wikimedia.org/wikipedia/commons/f/f8/Bhagwant_Mann.png",
  Rajasthan:
    "https://upload.wikimedia.org/wikipedia/commons/a/aa/Bhajan_Lal_Sharma.jpg",
  Sikkim:
    "https://upload.wikimedia.org/wikipedia/commons/7/72/Prem_Singh_Tamang%2C_Chief_Minister_of_Sikkim.jpg",
  "Tamil Nadu":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/The_Chief_Minister_of_Tamil_Nadu%2C_Thiru_MK_Stalin.jpeg/500px-The_Chief_Minister_of_Tamil_Nadu%2C_Thiru_MK_Stalin.jpeg",
  Telangana:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Portrait_of_Telangana_CM_Revanth_Reddy.png/500px-Portrait_of_Telangana_CM_Revanth_Reddy.png",
  Tripura:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Manik_Saha_Official_Portrait_2023.jpg/500px-Manik_Saha_Official_Portrait_2023.jpg",
  "Uttar Pradesh":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/PM_and_UP_CM_at_laying_the_foundation_stone_of_the_International_Cricket_Stadium_at_Varanasi%2C_in_Uttar_Pradesh_%283x4_cropped%29.jpg/500px-PM_and_UP_CM_at_laying_the_foundation_stone_of_the_International_Cricket_Stadium_at_Varanasi%2C_in_Uttar_Pradesh_%283x4_cropped%29.jpg",
  Uttarakhand:
    "https://upload.wikimedia.org/wikipedia/commons/9/95/Pushkar_Singh_Dhami%2C_Chief_Minister_of_Uttarakhand.jpg",
  "West Bengal":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Official_portrait_of_Mamata_Banerjee.jpg/500px-Official_portrait_of_Mamata_Banerjee.jpg",
} as const;

// --- Certificate DOM Component ---
interface CertificateDOMProps {
  location: LocationState | null;
  capturedImage: string | null;
  issueType: string | null;
  cmImageUrl: string | null;
}

const CertificateDOM = forwardRef<HTMLDivElement, CertificateDOMProps>(
  ({ location, capturedImage, issueType, cmImageUrl }, ref) => {
    const qrCanvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
      const scriptId = "qrious-script";
      if (document.getElementById(scriptId)) {
        // Script already loaded or loading
        if (window.QRious && qrCanvasRef.current && location) {
          //@ts-expect-error : will fix later
          new window.QRious({
            element: qrCanvasRef.current,
            value: `Issue Location: ${location.address}`,
            size: 200,
            background: "white",
            foreground: "black",
          });
        }
        return;
      }

      const script = document.createElement("script");
      script.id = scriptId;
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js";
      script.async = true;
      script.onload = () => {
        if (window.QRious && qrCanvasRef.current && location) {
          //@ts-expect-error : will fix later
          new window.QRious({
            element: qrCanvasRef.current,
            value: `Issue Location: ${location.address}`,
            size: 200,
            background: "white",
            foreground: "black",
          });
        }
      };
      document.body.appendChild(script);
    }, [location]);

    if (!location || !capturedImage || !issueType) return null;

    const uniqueId = `CN-${Date.now().toString().slice(-6)}`;

    return (
      <div
        ref={ref}
        className="w-[827px] h-[1169px] bg-white p-6 border-[10px] border-[#f0ad4e] font-['Inter',_sans-serif] text-black"
        style={{ fontFamily: "Inter, sans-serif" }}
      >
        <div className="w-full h-full border-[3px] border-[#1a3a8a] flex flex-col items-center p-8">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Emblem_of_India.svg/120px-Emblem_of_India.svg.png"
            alt="Emblem of India"
            className="h-24 w-24"
            crossOrigin="anonymous"
          />
          <p className="text-2xl font-bold mt-2">
            Ministry of Public Grievances
          </p>
          <p className="text-xl">Government of India</p>
          <p className="text-4xl font-bold text-[#1a3a8a] mt-6">
            Certificate of Civic Negligence
          </p>
          <p className="text-lg text-gray-600 mt-2">
            Issued on: {new Date().toLocaleDateString("en-GB")}
          </p>

          <div className="w-full flex mt-10">
            <div className="flex-1 pr-8">
              <h2 className="text-xl font-bold border-b pb-2">Issue Details</h2>
              <div className="text-lg mt-4 space-y-3">
                <p>
                  <span className="text-gray-500 w-48 inline-block">
                    Issue ID:
                  </span>{" "}
                  <span className="font-bold">{uniqueId}</span>
                </p>
                <p>
                  <span className="text-gray-500 w-48 inline-block">
                    Issue Type:
                  </span>{" "}
                  <span className="font-bold">{issueType}</span>
                </p>
                <p>
                  <span className="text-gray-500 w-48 inline-block">
                    Date of Report:
                  </span>{" "}
                  <span className="font-bold">
                    {new Date().toLocaleString("en-GB")}
                  </span>
                </p>
                <p>
                  <span className="text-gray-500 w-48 inline-block">
                    Reported By:
                  </span>{" "}
                  <span className="font-bold">A Concerned Citizen</span>
                </p>
                <p>
                  <span className="text-gray-500 w-48 inline-block">
                    Verification Status:
                  </span>{" "}
                  <span className="font-bold">Visually Confirmed</span>
                </p>
                <div className="flex">
                  <p className="text-gray-500 w-48 flex-shrink-0">Location:</p>
                  <p className="font-bold">{location.address}</p>
                </div>
              </div>
            </div>
            <div className="w-64 flex-shrink-0 text-center">
              <img
                src={capturedImage}
                alt="Captured issue"
                className="w-full border-2 border-gray-300 rounded-md"
              />
              <p className="text-sm italic text-gray-600 mt-2">
                Evidence Photo
              </p>
            </div>
          </div>

          <div className="mt-auto w-full h-64 bg-[#f0f4ff] flex items-center p-6 space-x-6">
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/4/44/Shri_Narendra_Modi%2C_Prime_Minister_of_India.jpg"
              alt="Prime Minister"
              className="h-40 rounded"
              crossOrigin="anonymous"
            />
            {cmImageUrl && (
              <img
                src={cmImageUrl}
                alt="State CM"
                className="h-40 rounded"
                crossOrigin="anonymous"
              />
            )}
            <div className="flex-1 text-left">
              <p className="text-xl italic font-bold text-[#1a3a8a]">
                “Together, we can document
              </p>
              <p className="text-xl italic font-bold text-[#1a3a8a]">
                and ignore civic issues.”
              </p>
              <p className="text-base text-gray-800 mt-2">
                - A Grateful Administration
              </p>
            </div>
            <canvas ref={qrCanvasRef} className="w-32 h-32"></canvas>
          </div>
          <p className="font-bold text-2xl mt-6">
            NEGLIGENCE WINS OVER COMPLAINTS
          </p>
        </div>
      </div>
    );
  }
);
CertificateDOM.displayName = "CertificateDOM";

const getCMImageUrl = (state: string | null | undefined): string | null => {
  const placeholder = null;
  if (!state) {
    return placeholder;
  }

  // Normalize the input state name for robust matching (lowercase, remove '&', trim whitespace)
  const normalizedState = state.toLowerCase().replace(/&/g, "and").trim();

  // 1. Attempt an exact match first (after normalization)
  const exactMatchKey = Object.keys(CM_DATA).find(
    (key) => key.toLowerCase().replace(/&/g, "and").trim() === normalizedState
  );

  //@ts-expect-error : will fix this later
  const img = exactMatchKey && CM_DATA[exactMatchKey];
  if (img) {
    return img;
  }

  // 2. If no exact match, attempt a partial match (e.g., "Delhi" vs "NCT of Delhi")
  const partialMatchKey = Object.keys(CM_DATA).find((key) => {
    const normalizedKey = key.toLowerCase().replace(/&/g, "and").trim();
    // Check if one string contains the other
    return (
      normalizedKey.includes(normalizedState) ||
      normalizedState.includes(normalizedKey)
    );
  });
  //@ts-expect-error : will fix this later
  const img2 = partialMatchKey && CM_DATA[partialMatchKey];
  if (img2) {
    return img2;
  }

  // 3. If still no match is found, return the default placeholder
  return placeholder;
};

const getCMImageUrl2 = (state: string | null | undefined): string | null => {
  const placeholder = null;
  if (!state) {
    return placeholder;
  }

  // Helper function to clean and tokenize a string into a set of words
  const normalizeAndTokenize = (str: string): Set<string> => {
    const normalized = str
      .toLowerCase()
      .replace(/&/g, "and") // Standardize ampersands
      .replace(/[^a-z\s]/g, "") // Remove all non-alphabetic characters except spaces
      .trim();
    return new Set(normalized.split(/\s+/).filter((word) => word.length > 0));
  };

  const stateWords = normalizeAndTokenize(state);
  if (stateWords.size === 0) {
    return placeholder;
  }

  let bestMatch = {
    key: "",
    score: 0.0,
  };

  // 1. Iterate through all possible CM data keys to find the best fuzzy match
  for (const key of Object.keys(CM_DATA)) {
    const keyWords = normalizeAndTokenize(key);
    if (keyWords.size === 0) {
      continue;
    }

    // Calculate the intersection of the two word sets (words they have in common)
    const intersection = new Set(
      [...stateWords].filter((word) => keyWords.has(word))
    );

    // Calculate the union of the two word sets (all unique words from both)
    const union = new Set([...stateWords, ...keyWords]);

    // Use Jaccard Similarity score: (size of intersection) / (size of union)
    // This gives a score from 0.0 (no similarity) to 1.0 (identical)
    const score = intersection.size / union.size;

    // If this key is a better match than what we've seen, store it
    if (score > bestMatch.score) {
      bestMatch = { key, score };
    }
  }

  // 2. Set a reasonable threshold to consider it a valid match.
  // This avoids incorrect matches on very dissimilar names.
  // A score of 0.4 means a 40% overlap in unique words.
  const SIMILARITY_THRESHOLD = 0.4;
  //@ts-expect-error : will fix later
  const img = bestMatch.score >= SIMILARITY_THRESHOLD && CM_DATA[bestMatch.key];
  if (img) {
    return img;
  }

  // 3. If no high-confidence match is found, return the default placeholder
  return placeholder;
};

// --- Main App Component ---
export default function PotholeCertificateApp() {
  const [step, setStep] = useState<AppStep>("initial");
  const [location, setLocation] = useState<LocationState | null>(null);
  const [error, setError] = useState("");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [generatedCertificate, setGeneratedCertificate] = useState<
    string | null
  >(null);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [issueType, setIssueType] = useState<string | null>(null);

  const [cmImageUrl, setCmImageUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const certificateRef = useRef<HTMLDivElement>(null);

  // Load html-to-image script from CDN
  useEffect(() => {
    const scriptId = "html-to-image-script";
    if (document.getElementById(scriptId)) return; // Already loaded

    const script = document.createElement("script");
    script.id = scriptId;
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startCaptureSequence = async (type: string) => {
    setIssueType(type);
    setError("");
    setStep("capture");
    setLoadingMessage("Initializing systems...");

    try {
      setLoadingMessage("Requesting camera access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setLoadingMessage("Fetching your location...");
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setLoadingMessage("Pinpointing address...");
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
          );
          const data = await response.json();

          const state = data.address?.state;
          console.log({ state });

          const imgUrl = getCMImageUrl(state) || getCMImageUrl2(state);

          setCmImageUrl(imgUrl);

          setLocation({
            latitude,
            longitude,
            address: data.display_name || "Address not found",
          });
          setLoadingMessage("");
        },
        (err) => {
          let errorMessage =
            "Unable to retrieve your location. Please enable location services in your OS and browser.";
          if (err.code === 1) {
            // PERMISSION_DENIED
            errorMessage =
              "Location access was denied. Please grant permission in your browser settings.";
          } else if (err.code === 2) {
            // POSITION_UNAVAILABLE
            errorMessage =
              "Location information is unavailable. Please check your network connection or try again.";
          } else if (err.code === 3) {
            // TIMEOUT
            errorMessage =
              "Failed to get your location in time. Please check your network connection and try again.";
          }
          console.error("Geolocation error:", err);
          setError(errorMessage);
          stopCamera();
          setStep("initial");
        },
        {
          enableHighAccuracy: false, // More likely to succeed, might be slightly less accurate
          timeout: 10000, // Wait 10 seconds
          maximumAge: 0, // Don't use a cached position
        }
      );
    } catch (err: unknown) {
      console.error(err);
      let errorMessage = "Could not access camera. Please check permissions.";
      //@ts-expect-error : will fix later
      if (err.name === "NotAllowedError") {
        errorMessage =
          "Camera access was denied. Please grant permission in your browser settings.";
      }
      setError(errorMessage);
      stopCamera();
      setStep("initial");
    }
  };

  const generateCertificate = async () => {
    if (!certificateRef.current) {
      setError("Failed to create certificate. Certificate template not found.");
      setStep("initial");
      return;
    }
    if (!window.htmlToImage) {
      setError(
        "Image generation library not loaded yet. Please try again in a moment."
      );
      setStep("initial"); // or back to capture
      return;
    }

    setLoadingMessage("Generating high-resolution image...");
    try {
      //@ts-expect-error : wull fix later
      const dataUrl = await window.htmlToImage.toPng(certificateRef.current, {
        cacheBust: true,
        pixelRatio: 2, // for better resolution
        fetchOptions: {
          mode: "cors",
        },
      });
      setGeneratedCertificate(dataUrl);
      setLoadingMessage("");
      setStep("result");
    } catch (err) {
      console.error("Failed to generate certificate image", err);
      setError(
        "An error occurred while generating the certificate image. This can happen with certain browsers or network conditions."
      );
      setStep("initial");
    }
  };

  const handleCapture = () => {
    if (videoRef.current) {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = videoRef.current.videoWidth;
      tempCanvas.height = videoRef.current.videoHeight;
      const context = tempCanvas.getContext("2d");
      if (context) {
        context.drawImage(
          videoRef.current,
          0,
          0,
          tempCanvas.width,
          tempCanvas.height
        );
        const imageDataUrl = tempCanvas.toDataURL("image/jpeg");
        setCapturedImage(imageDataUrl);
      }
      stopCamera();
      setStep("generating");
    }
  };

  useEffect(() => {
    if (step === "generating" && capturedImage && location) {
      // A small delay to ensure the DOM is ready before capturing
      setTimeout(generateCertificate, 100);
    }
  }, [step, capturedImage, location]);

  useEffect(() => {
    function hasDebugParam(url?: string): boolean {
      try {
        const targetUrl = url || window.location.href;
        const urlObj = new URL(targetUrl);
        return urlObj.searchParams.has("debug");
      } catch (error) {
        console.error("Invalid URL provided:", error);
        return false;
      }
    }
    hasDebugParam(window.location.href) && new UIConsole();
  }, []);

  const handleReset = () => {
    setStep("initial");
    setLocation(null);
    setError("");
    setCapturedImage(null);
    setGeneratedCertificate(null);
    stopCamera();
    setIssueType(null);
  };

  const handleDownload = () => {
    if (!generatedCertificate) return;
    const link = document.createElement("a");
    link.download = `certificate-of-negligence-${Date.now()}.png`;
    link.href = generatedCertificate;
    link.click();
  };

  const handleShare = () => {
    if (!location || !generatedCertificate || isSharing || !issueType) return;

    setIsSharing(true);
    // 1. Trigger download first
    handleDownload();

    // 2. Open Twitter intent after a short delay to ensure download starts
    setTimeout(() => {
      const text = `I've identified a "${issueType}" issue and generated a Certificate of Negligence. Location: ${location.address}. Requesting attention from the authorities. #CivicNegligence #InfraFail`;
      const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        text
      )}`;
      window.open(url, "_blank");

      // Reset button state
      setTimeout(() => setIsSharing(false), 2000);
    }, 500);
  };

  return (
    <div className="bg-gray-100 min-h-screen font-sans flex flex-col items-center justify-center p-4">
      {/* This container is used for rendering the certificate off-screen to generate the image */}
      <div className="absolute -left-[9999px] -top-[9999px]">
        {step === "generating" && (
          <CertificateDOM
            ref={certificateRef}
            location={location}
            capturedImage={capturedImage}
            issueType={issueType}
            cmImageUrl={cmImageUrl}
          />
        )}
      </div>

      <div className="w-full max-w-2xl mx-auto bg-white rounded-2xl shadow-xl p-6 md:p-8 text-gray-800">
        <header className="text-center mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            Certificate of Civic Negligence
          </h1>
          <p className="text-gray-600 mt-2">
            Highlighting infrastructure issues, one certificate at a time.
          </p>
        </header>

        {error && (
          <div
            className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md"
            role="alert"
          >
            <p>{error}</p>
          </div>
        )}

        {step === "initial" && (
          <div className="text-center">
            <p className="mb-6">
              {`This app helps you document potholes, garbage, or other civic
              issues by generating a formal-looking 'certificate'.`}
            </p>
            <button
              onClick={() => setStep("selectIssue")}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-lg shadow-lg transform hover:scale-105 transition-transform duration-300 ease-in-out flex items-center justify-center mx-auto"
            >
              <IconCamera className="mr-2" />
              Report an Issue
            </button>
          </div>
        )}

        {step === "selectIssue" && (
          <div>
            <h2 className="text-xl font-bold text-center mb-6">
              What type of issue are you reporting?
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {issueTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => startCaptureSequence(type)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-4 px-4 rounded-lg shadow-sm transition-colors duration-200"
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "capture" && (
          <div>
            <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden mb-4 shadow-inner">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              ></video>
              {loadingMessage && (
                <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center">
                  <p className="text-white text-xl animate-pulse">
                    {loadingMessage}
                  </p>
                </div>
              )}
            </div>
            {location && (
              <div className="bg-gray-50 p-3 rounded-lg mb-4 text-sm text-gray-700 flex items-start">
                <IconMapPin className="text-gray-500 mr-2 mt-1 flex-shrink-0" />
                <div>
                  <strong className="font-semibold">Location Found:</strong>{" "}
                  {location.address}
                </div>
              </div>
            )}
            <button
              onClick={handleCapture}
              disabled={!location || !!loadingMessage}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg text-lg shadow-lg flex items-center justify-center disabled:bg-gray-400 disabled:cursor-not-allowed transform hover:scale-105 transition-transform duration-300 ease-in-out"
            >
              <IconCamera className="mr-2" />
              Capture Photo
            </button>
          </div>
        )}

        {step === "generating" && (
          <div className="text-center p-8">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-lg font-semibold">
              {loadingMessage || "Generating your certificate..."}
            </p>
          </div>
        )}

        {step === "result" && generatedCertificate && (
          <div>
            <h2 className="text-2xl font-bold text-center mb-4">
              Certificate Generated Successfully!
            </h2>
            <img
              src={generatedCertificate}
              alt="Generated Certificate of Civic Negligence"
              className="w-full rounded-lg shadow-lg border"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <button
                onClick={handleShare}
                disabled={isSharing}
                className="bg-white hover:bg-gray-50 text-gray-800 font-bold py-3 px-4 rounded-lg shadow border flex items-center justify-center transition-colors disabled:opacity-50"
              >
                <IconTwitter className="mr-2 h-6 w-6" />
                {isSharing ? "Downloading..." : "Share on X"}
              </button>
              <button
                onClick={handleDownload}
                className="bg-gray-700 hover:bg-gray-800 text-white font-bold py-3 px-4 rounded-lg shadow flex items-center justify-center transition-colors"
              >
                <IconDownload className="mr-2" />
                Download
              </button>
              <button
                onClick={handleReset}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-4 rounded-lg shadow flex items-center justify-center transition-colors"
              >
                <IconRefresh className="mr-2" />
                Start Over
              </button>
            </div>
            <p className="text-xs text-center mt-4 text-gray-500">
              {`We'll download the image for you. Please attach the downloaded
              file to your post on X (Twitter).`}
            </p>
          </div>
        )}

        <footer className="text-center mt-8 text-sm text-gray-500">
          <p>
            &copy; {new Date().getFullYear()} Satirical Services Inc. For
            commentary purposes only.
          </p>
        </footer>
      </div>
    </div>
  );
}
