::[Bat To Exe Converter]
::
::YAwzoRdxOk+EWAnk
::fBw5plQjdG8=
::YAwzuBVtJxjWCl3EqQJgSA==
::ZR4luwNxJguZRRnk
::Yhs/ulQjdF+5
::cxAkpRVqdFKZSDk=
::cBs/ulQjdF+5
::ZR41oxFsdFKZSDk=
::eBoioBt6dFKZSDk=
::cRo6pxp7LAbNWATEpCI=
::egkzugNsPRvcWATEpCI=
::dAsiuh18IRvcCxnZtBJQ
::cRYluBh/LU+EWAnk
::YxY4rhs+aU+JeA==
::cxY6rQJ7JhzQF1fEqQJQ
::ZQ05rAF9IBncCkqN+0xwdVs0
::ZQ05rAF9IAHYFVzEqQJQ
::eg0/rx1wNQPfEVWB+kM9LVsJDGQ=
::fBEirQZwNQPfEVWB+kM9LVsJDGQ=
::cRolqwZ3JBvQF1fEqQJQ
::dhA7uBVwLU+EWDk=
::YQ03rBFzNR3SWATElA==
::dhAmsQZ3MwfNWATElA==
::ZQ0/vhVqMQ3MEVWAtB9wSA==
::Zg8zqx1/OA3MEVWAtB9wSA==
::dhA7pRFwIByZRRnk
::Zh4grVQjdCyDJEmW+0g1Kw9HcAmNKnK1VOVOvtT/6vmMtkINFOQtd4HPmrmBNvkc1mjrY48i5mhTlt8JHihdbASibQp5gGBRomWJO4mZqwqB
::YB416Ek+ZG8=
::
::
::978f952a14a936cc963da21a135fa983
@echo off
cd /d "%~dp0"

nssm stop MovyoPrinterService
nssm remove MovyoPrinterService confirm

nssm install MovyoPrinterService "%~dp0MovyoPrinterService.exe"
nssm set MovyoPrinterService Start SERVICE_AUTO_START
nssm set MovyoPrinterService AppDirectory "%~dp0"
nssm set MovyoPrinterService DisplayName "Movyo Printer Service"
nssm set MovyoPrinterService Description "Serviço local de impressão do Movyo Food"

nssm start MovyoPrinterService