import type { ChainConfig } from '../lib/chains'
import {
  explorerTxUrl,
  formatTxTime,
  shortHash,
  type TxReceiptData,
} from '../lib/transactionStore'
import { CopyButton } from './CopyButton'

interface TxReceiptModalProps {
  receipt: TxReceiptData
  chain: ChainConfig
  onClose: () => void
}

export function TxReceiptModal({ receipt, chain, onClose }: TxReceiptModalProps) {
  const isSend = receipt.kind === 'send'

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="receipt-card">
        <div className={`receipt-status ${receipt.status}`}>
          <span className="receipt-icon">{isSend ? '✓' : '↓'}</span>
          <div>
            <h2>{isSend ? 'تراکنش ارسال شد' : 'رسید دریافت'}</h2>
            <p>{isSend ? 'تراکنش با موفقیت ثبت شد' : 'آدرس دریافت تأیید شد'}</p>
          </div>
        </div>

        <dl className="receipt-details">
          <div className="receipt-row">
            <dt>شبکه</dt>
            <dd>{receipt.chainName}</dd>
          </div>
          <div className="receipt-row">
            <dt>دارایی</dt>
            <dd>{receipt.symbol}</dd>
          </div>
          {receipt.amount && (
            <div className="receipt-row highlight">
              <dt>مقدار</dt>
              <dd dir="ltr">{receipt.amount} {receipt.symbol}</dd>
            </div>
          )}
          {isSend && (
            <>
              <div className="receipt-row">
                <dt>از</dt>
                <dd dir="ltr" className="mono">{shortHash(receipt.from)}</dd>
              </div>
              <div className="receipt-row">
                <dt>به</dt>
                <dd dir="ltr" className="mono">{shortHash(receipt.to)}</dd>
              </div>
            </>
          )}
          {!isSend && (
            <div className="receipt-row">
              <dt>آدرس دریافت</dt>
              <dd dir="ltr" className="mono break">{receipt.to}</dd>
            </div>
          )}
          {receipt.hash && (
            <div className="receipt-row">
              <dt>شناسه تراکنش</dt>
              <dd dir="ltr" className="mono break">{receipt.hash}</dd>
            </div>
          )}
          <div className="receipt-row">
            <dt>زمان</dt>
            <dd>{formatTxTime(receipt.timestamp)}</dd>
          </div>
          <div className="receipt-row">
            <dt>وضعیت</dt>
            <dd className="status-confirmed">تأیید شده</dd>
          </div>
        </dl>

        {receipt.note && <p className="hint receipt-note">{receipt.note}</p>}

        <div className="receipt-actions">
          {receipt.hash && (
            <a
              className="btn-ghost"
              href={explorerTxUrl(receipt.explorerUrl, receipt.hash, chain.type)}
              target="_blank"
              rel="noreferrer"
            >
              مشاهده در Explorer
            </a>
          )}
          {!isSend && <CopyButton text={receipt.to} label="کپی آدرس" />}
          <button type="button" className="btn-primary btn-sm" onClick={onClose}>
            بستن
          </button>
        </div>
      </div>
    </div>
  )
}
