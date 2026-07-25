"use client"

import { useState } from "react"
import { ShieldCheck, LockKeyhole } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"

interface OtpGateProps {
  onVerified: (otp: string) => void
}

export function OtpGate({ onVerified }: OtpGateProps) {
  const [otp, setOtp] = useState("")
  const [error, setError] = useState("")

  const handleVerify = () => {
    if (otp !== "216917") {
      setError("OTP không đúng. Vui lòng kiểm tra lại.")
      return
    }
    setError("")
    onVerified(otp)
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-md border-emerald-500/20 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <CardTitle className="mt-3 text-2xl">Xác thực OTP</CardTitle>
          <CardDescription>
            Module Dòng tiền chỉ mở cho tài khoản quản lý được chỉ định. Nhập OTP để tiếp tục.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          ) : null}

          <Button className="w-full" onClick={handleVerify} disabled={otp.length !== 6}>
            <LockKeyhole className="mr-2 h-4 w-4" />
            Mở module Dòng tiền
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
