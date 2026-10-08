-- Shop PromptPay / wallet destination (user-ordered)
update shop_settings
set receive_account = '0928160016',
    wallet_phone = coalesce(nullif(trim(wallet_phone), ''), '0928160016'),
    receive_name = coalesce(nullif(trim(receive_name), ''), 'VELTSHOP')
where id = 1;
